// ============================================
// Module Premium - API Export Avancé
// Edge Function: API Export (External Access)
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bcrypt } from 'https://deno.land/x/bcrypt/mod.ts';
import {
  requireExportApiAccess,
  checkExportQuota,
  checkConcurrentExportLimit,
  logExportAction
} from '../_shared/exportModuleCheck.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, x-novaconnect-api-token, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get API token from header
    const apiToken = req.headers.get('X-NovaConnect-API-Token');
    if (!apiToken) {
      throw new Error('API token is required. Use X-NovaConnect-API-Token header.');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate token and get school
    const validationResult = await validateApiToken(supabaseClient, apiToken);
    if (!validationResult.valid) {
      throw new Error(validationResult.error || 'Invalid or expired API token');
    }

    const { schoolId, token, permissions } = validationResult;

    // Parse request
    const { exportType, resourceType, filters = {}, returnUrl = false } = await req.json();

    if (!exportType || !resourceType) {
      throw new Error('exportType and resourceType are required');
    }

    // Check permissions
    if (!permissions.includes(resourceType)) {
      throw new Error(`Your API token does not have permission to export ${resourceType}`);
    }

    // Check premium access
    await requireExportApiAccess(supabaseClient, schoolId);

    // Check quota
    const quotaCheck = await checkExportQuota(supabaseClient, schoolId);
    if (!quotaCheck.canExport) {
      throw new Error(quotaCheck.error);
    }

    // Check concurrent limit
    const canProceed = await checkConcurrentExportLimit(supabaseClient, schoolId);
    if (!canProceed) {
      throw new Error('Too many concurrent exports. Please try again later.');
    }

    // Create export job
    const { data: job, error: jobError } = await supabaseClient
      .from('export_jobs')
      .insert({
        school_id: schoolId,
        export_type: exportType,
        resource_type: resourceType,
        status: 'processing',
        filters: filters as any,
        initiated_by: token.created_by,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Failed to create export job');
    }

    // Update token usage
    await supabaseClient
      .from('export_api_tokens')
      .update({
        usage_count: (token.usage_count || 0) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', token.id);

    // Log API request
    await logExportAction(supabaseClient, schoolId, token.created_by, 'EXPORT_API_REQUEST', {
      job_id: job.id,
      resource_type: resourceType,
      export_type: exportType,
      token_id: token.id
    });

    // Process export asynchronously
    processExportAsync(job.id, schoolId, exportType, resourceType, filters, token.created_by)
      .catch(async (error) => {
        await supabaseClient.from('export_jobs').update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        }).eq('id', job.id);
      });

    // Return based on returnUrl flag
    if (returnUrl) {
      // Wait for completion and return URL
      // For now, return job ID
      return new Response(
        JSON.stringify({
          success: true,
          jobId: job.id,
          status: 'processing',
          message: 'Export is processing. Use the job ID to check status and download.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          jobId: job.id,
          status: 'processing'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Error in api-export:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: error.message.includes('token') ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function validateApiToken(
  supabaseClient: any,
  apiToken: string
): Promise<{
  valid: boolean;
  schoolId?: string;
  token?: any;
  permissions?: string[];
  error?: string;
}> {
  try {
    // Get all active tokens
    const { data: tokens, error } = await supabaseClient
      .from('export_api_tokens')
      .select('*')
      .eq('revoked_at', null);

    if (error) {
      return { valid: false, error: 'Failed to validate token' };
    }

    // Find matching token by comparing hash
    let matchedToken = null;
    for (const token of tokens || []) {
      const match = await bcrypt.compare(apiToken, token.token_hash);
      if (match) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      return { valid: false, error: 'Invalid API token' };
    }

    // Check expiration
    if (matchedToken.expires_at && new Date(matchedToken.expires_at) < new Date()) {
      return { valid: false, error: 'API token has expired' };
    }

    // Check rate limit
    if (matchedToken.rate_limit_per_hour > 0) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const { count } = await supabaseClient
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'EXPORT_API_REQUEST')
        .eq('school_id', matchedToken.school_id)
        .gte('created_at', oneHourAgo.toISOString());

      if ((count || 0) >= matchedToken.rate_limit_per_hour) {
        return { valid: false, error: 'Rate limit exceeded. Please try again later.' };
      }
    }

    return {
      valid: true,
      schoolId: matchedToken.school_id,
      token: matchedToken,
      permissions: matchedToken.permissions
    };

  } catch (error: any) {
    console.error('Error validating API token:', error);
    return { valid: false, error: 'Token validation failed' };
  }
}

async function processExportAsync(
  jobId: string,
  schoolId: string,
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

    // Use default template config if none provided
    const templateConfig = {
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
      // Import SheetJS
      const XLSX = await import('https://esm.sh/sheetjs-style@0.15.7');

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(transformedData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fileBuffer = new Uint8Array(buffer);
      fileName = `${jobId}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (exportType === 'csv') {
      // Generate CSV
      const headers = Object.keys(transformedData[0] || {});
      let csv = '\uFEFF'; // BOM for Excel
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
      // Import jsPDF
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

    // Log completion
    await logExportAction(supabaseClient, schoolId, userId, 'EXPORT_JOB_STATUS_CHANGED', {
      job_id: jobId,
      status: 'completed',
      row_count: transformedData.length,
      file_size_bytes: fileBuffer.length
    });

  } catch (error: any) {
    console.error('Error processing export:', error);

    // Update job to failed
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
