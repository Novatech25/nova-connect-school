// ============================================
// Module Premium - API Export Avancé
// Edge Function: Run Scheduled Exports
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Verify service role key
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!authHeader || !authHeader.endsWith(serviceRoleKey || '')) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey ?? ''
    );

    // Get all due scheduled exports with template info
    const { data: scheduledExports, error } = await supabaseClient
      .from('scheduled_exports')
      .select(`
        *,
        template:export_templates(*)
      `)
      .eq('is_active', true)
      .lte('next_run_at', new Date().toISOString());

    if (error) {
      console.error('Error fetching scheduled exports:', error);
      return new Response('Error fetching scheduled exports', { status: 500 });
    }

    const results = [];

    // Process each scheduled export
    for (const scheduledExport of scheduledExports || []) {
      try {
        // Check premium access
        const { data: school } = await supabaseClient
          .from('schools')
          .select('license_type, license_expires_at, enabled_modules')
          .eq('id', scheduledExport.school_id)
          .single();

        if (!school) {
          throw new Error('School not found');
        }

        // Verify license
        if (!['premium', 'enterprise'].includes(school.license_type)) {
          throw new Error('School does not have premium license');
        }

        if (school.license_expires_at && new Date(school.license_expires_at) < new Date()) {
          throw new Error('School license has expired');
        }

        // Verify module enabled
        const enabledModules = school.enabled_modules || [];
        if (!enabledModules.includes('api_export')) {
          throw new Error('API export module not enabled');
        }

        // Get export type and resource type from template
        const exportType = scheduledExport.template?.export_type || 'excel';
        const resourceType = scheduledExport.template?.resource_type || 'students';

        // Create export job with proper types
        const { data: job } = await supabaseClient
          .from('export_jobs')
          .insert({
            school_id: scheduledExport.school_id,
            template_id: scheduledExport.template_id,
            export_type: exportType,
            resource_type: resourceType,
            status: 'pending',
            filters: scheduledExport.filters,
            initiated_by: scheduledExport.created_by,
            scheduled_job_id: scheduledExport.id,
            started_at: new Date().toISOString()
          })
          .select()
          .single();

        // Process the export asynchronously
        processExportAsync(
          job.id,
          scheduledExport.school_id,
          scheduledExport.template,
          exportType,
          resourceType,
          scheduledExport.filters,
          scheduledExport.created_by
        ).catch(async (error) => {
          console.error('Error processing export:', error);
          await supabaseClient.from('export_jobs').update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          }).eq('id', job.id);
        });

        // Calculate next run time using cron expression
        const { data: nextRunTime } = await supabaseClient
          .rpc('calculate_next_run_time', {
            cron_expr: scheduledExport.cron_expression,
            last_run: new Date().toISOString()
          });

        // Update next run time
        await supabaseClient
          .from('scheduled_exports')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRunTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('id', scheduledExport.id);

        results.push({ success: true, jobId: job.id, scheduledExportId: scheduledExport.id });

        // Send email notifications to recipients
        if (scheduledExport.recipients && Array.isArray(scheduledExport.recipients)) {
          // TODO: Implement email sending with download link
          console.log('Would send email to:', scheduledExport.recipients);
        }

      } catch (error: any) {
        console.error('Error processing scheduled export:', scheduledExport.id, error);
        results.push({
          success: false,
          scheduledExportId: scheduledExport.id,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in run-scheduled-exports:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// Async function to process export (doesn't block response)
async function processExportAsync(
  jobId: string,
  schoolId: string,
  template: any,
  exportType: string,
  resourceType: string,
  filters: Record<string, any>,
  userId: string
) {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Import shared data fetching and transformation
    const { fetchExportData, transformData } = await import('../_shared/exportData.ts');

    // Fetch data
    const data = await fetchExportData(supabaseClient, schoolId, resourceType, filters);
    if (!data || data.length === 0) {
      throw new Error('No data found for the specified filters');
    }

    // Use template config or default
    const templateConfig = template?.template_config || {
      columns: Object.keys(data[0] || {}).map((key) => ({
        key,
        header: key,
        visible: true
      }))
    };

    // Transform data
    const transformedData = transformData(data, templateConfig, resourceType);

    // Generate file based on export type
    let fileBuffer: Uint8Array;
    let fileName: string;
    let contentType: string;

    if (exportType === 'excel') {
      const XLSX = await import('https://esm.sh/sheetjs-style@0.15.7');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(transformedData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fileBuffer = new Uint8Array(buffer);
      fileName = `${jobId}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (exportType === 'csv') {
      const headers = Object.keys(transformedData[0] || {});
      let csv = '\uFEFF';
      csv += headers.join(',') + '\n';
      for (const row of transformedData) {
        const values = headers.map(header => {
          const value = row[header];
          const strValue = String(value ?? '');
          if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replaceAll('"', '""')}"`;
          }
          return strValue;
        });
        csv += values.join(',') + '\n';
      }
      fileBuffer = new TextEncoder().encode(csv);
      fileName = `${jobId}.csv`;
      contentType = 'text/csv';
    } else if (exportType === 'pdf') {
      const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
      await import('https://esm.sh/jspdf-autotable@3.5.31');
      const doc = new (jsPDF as any)();
      const headers = transformedData.length > 0 ? Object.keys(transformedData[0]) : [];
      const rows = transformedData.map(row => Object.values(row));
      (doc as any).autoTable({
        head: [headers],
        body: rows,
        startY: 20,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' }
      });
      const buffer = doc.output('arraybuffer');
      fileBuffer = new Uint8Array(buffer);
      fileName = `${jobId}.pdf`;
      contentType = 'application/pdf';
    } else {
      throw new Error(`Unsupported export type: ${exportType}`);
    }

    // Upload to storage
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const filePath = `${schoolId}/${year}/${month}/${fileName}`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from('exports')
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Update job
    await supabaseClient
      .from('export_jobs')
      .update({
        status: 'completed',
        file_path: filePath,
        file_size_bytes: fileBuffer.length,
        row_count: transformedData.length,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

  } catch (error: any) {
    console.error('Error processing export:', error);
    await supabaseClient
      .from('export_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
    throw error;
  }
}
