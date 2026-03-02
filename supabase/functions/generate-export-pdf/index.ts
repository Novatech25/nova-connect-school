// ============================================
// Module Premium - API Export Avancé
// Edge Function: Generate PDF Export
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';
import 'https://esm.sh/jspdf-autotable@3.5.31';
import {
  requireExportApiAccess,
  checkExportQuota,
  checkConcurrentExportLimit,
  logExportAction,
  getUserExportSchoolId
} from '../_shared/exportModuleCheck.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header required');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Invalid authentication');

    const { templateId, templateConfig, resourceType, filters = {} } = await req.json();

    const schoolId = await getUserExportSchoolId(supabaseClient, user.id);
    if (!schoolId) throw new Error('User not associated with any school');

    await requireExportApiAccess(supabaseClient, schoolId);

    const quotaCheck = await checkExportQuota(supabaseClient, schoolId);
    if (!quotaCheck.canExport) throw new Error(quotaCheck.error);

    const canProceed = await checkConcurrentExportLimit(supabaseClient, schoolId);
    if (!canProceed) throw new Error('Too many concurrent exports');

    let template: any = null;
    if (templateId) {
      const { data: templateData } = await supabaseClient
        .from('export_templates')
        .select('*')
        .eq('id', templateId)
        .eq('school_id', schoolId)
        .single();
      template = templateData;
    } else if (templateConfig) {
      template = { template_config: templateConfig, resource_type: resourceType };
    } else {
      throw new Error('Either templateId or templateConfig required');
    }

    const { data: job } = await supabaseClient
      .from('export_jobs')
      .insert({
        school_id: schoolId,
        template_id: templateId,
        export_type: 'pdf',
        resource_type: resourceType,
        status: 'processing',
        filters: filters as any,
        initiated_by: user.id,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    await logExportAction(supabaseClient, schoolId, user.id, 'EXPORT_JOB_CREATED', {
      job_id: job.id,
      resource_type: resourceType
    });

    processExportAsync(job.id, schoolId, template, resourceType, filters, user.id)
      .catch(async (error) => {
        await supabaseClient.from('export_jobs').update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        }).eq('id', job.id);
      });

    return new Response(
      JSON.stringify({ success: true, jobId: job.id, status: 'processing' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: error.message.includes('licence') || error.message.includes('module') ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processExportAsync(
  jobId: string,
  schoolId: string,
  template: any,
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

    const data = await fetchExportData(supabaseClient, schoolId, resourceType, filters);
    if (!data || data.length === 0) throw new Error('No data found');

    const transformedData = transformData(data, template.template_config, resourceType);
    const pdfBuffer = await generatePDF(transformedData, template.template_config, schoolId);
    const fileName = `${jobId}.pdf`;
    const filePath = await uploadToStorage(supabaseClient, schoolId, fileName, pdfBuffer);

    await supabaseClient.from('export_jobs').update({
      status: 'completed',
      file_path: filePath,
      file_size_bytes: pdfBuffer.length,
      row_count: transformedData.length,
      completed_at: new Date().toISOString()
    }).eq('id', jobId);

    await logExportAction(supabaseClient, schoolId, userId, 'EXPORT_JOB_STATUS_CHANGED', {
      job_id: jobId,
      status: 'completed',
      row_count: transformedData.length
    });

  } catch (error: any) {
    await supabaseClient.from('export_jobs').update({
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString()
    }).eq('id', jobId);
    throw error;
  }
}

async function generatePDF(data: any[], templateConfig: any, schoolId: string): Promise<Uint8Array> {
  const doc = new jsPDF();

  // Get school info for header
  const styles = templateConfig.styles || {};

  // Add school logo if configured
  if (styles.logo) {
    // Logo would be added here
    // doc.addImage(logoData, 'PNG', 10, 10, 30, 30);
  }

  // Add title
  doc.setFontSize(16);
  doc.text('Export de données', 14, 20);

  // Add date
  doc.setFontSize(10);
  doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, 14, 28);

  // Add table
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  const rows = data.map(row => Object.values(row));

  (doc as any).autoTable({
    head: [headers],
    body: rows,
    startY: 35,
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    headStyles: {
      fillColor: [46, 125, 50],
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [240, 248, 229]
    }
  });

  // Add page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} / ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

async function uploadToStorage(
  supabaseClient: any,
  schoolId: string,
  fileName: string,
  buffer: Uint8Array
): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const filePath = `${schoolId}/${year}/${month}/${fileName}`;

  const { error } = await supabaseClient
    .storage
    .from('exports')
    .upload(filePath, buffer, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (error) throw new Error(`Failed to upload: ${error.message}`);
  return filePath;
}
