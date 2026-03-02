// ============================================
// Module Premium - API Export Avancé
// Edge Function: Generate Excel Export
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/sheetjs-style@0.15.7';
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

interface ExportRequest {
  templateId?: string;
  templateConfig?: any;
  exportType: 'excel';
  resourceType: 'bulletins' | 'students' | 'attendance' | 'payments' | 'payroll' | 'grades' | 'schedules' | 'lesson_logs' | 'student_cards' | 'exam_results';
  filters?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    // Get user from auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    // Parse request body
    const { templateId, templateConfig, resourceType, filters = {} }: ExportRequest = await req.json();

    if (!resourceType) {
      throw new Error('resourceType is required');
    }

    // Get user's school ID
    const schoolId = await getUserExportSchoolId(supabaseClient, user.id);
    if (!schoolId) {
      throw new Error('User is not associated with any school');
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
      throw new Error('Trop d\'exports en cours simultanés. Veuillez réessayer dans quelques minutes.');
    }

    // Get template
    let template: any = null;
    if (templateId) {
      const { data: templateData, error: templateError } = await supabaseClient
        .from('export_templates')
        .select('*')
        .eq('id', templateId)
        .eq('school_id', schoolId)
        .single();

      if (templateError || !templateData) {
        throw new Error('Template not found');
      }

      template = templateData;
    } else if (templateConfig) {
      // Use inline config
      template = {
        template_config: templateConfig,
        resource_type: resourceType
      };
    } else {
      throw new Error('Either templateId or templateConfig is required');
    }

    // Create export job
    const { data: job, error: jobError } = await supabaseClient
      .from('export_jobs')
      .insert({
        school_id: schoolId,
        template_id: templateId,
        export_type: 'excel',
        resource_type: resourceType,
        status: 'processing',
        filters: filters as any,
        initiated_by: user.id,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Failed to create export job');
    }

    // Log start
    await logExportAction(supabaseClient, schoolId, user.id, 'EXPORT_JOB_CREATED', {
      job_id: job.id,
      resource_type: resourceType
    });

    // Process export asynchronously
    processExportAsync(
      job.id,
      schoolId,
      template,
      resourceType,
      filters,
      user.id
    ).catch(async (error) => {
      console.error('Export processing error:', error);
      // Update job status to failed
      await supabaseClient
        .from('export_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);
    });

    // Return job ID immediately
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        status: 'processing'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in generate-export-excel:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: error.message.includes('licence') || error.message.includes('module') ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Async function to process export (doesn't block response)
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
    // Fetch data based on resource type
    const data = await fetchExportData(supabaseClient, schoolId, resourceType, filters);

    if (!data || data.length === 0) {
      throw new Error('Aucune donnée trouvée pour les filtres spécifiés');
    }

    // Transform data according to template
    const transformedData = transformData(data, template.template_config, resourceType);

    // Generate Excel file
    const excelBuffer = await generateExcel(transformedData, template.template_config, resourceType);

    // Upload to storage
    const fileName = `${jobId}.xlsx`;
    const filePath = await uploadToStorage(supabaseClient, schoolId, fileName, excelBuffer);

    // Update job status
    const { error: updateError } = await supabaseClient
      .from('export_jobs')
      .update({
        status: 'completed',
        file_path: filePath,
        file_size_bytes: excelBuffer.length,
        row_count: transformedData.length,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      throw new Error('Failed to update export job status');
    }

    // Log completion
    await logExportAction(supabaseClient, schoolId, userId, 'EXPORT_JOB_STATUS_CHANGED', {
      job_id: jobId,
      status: 'completed',
      row_count: transformedData.length,
      file_size_bytes: excelBuffer.length
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

// Fetch data based on resource type
async function fetchExportData(
  supabaseClient: any,
  schoolId: string,
  resourceType: string,
  filters: Record<string, any>
): Promise<any[]> {
  let query: any;

  switch (resourceType) {
    case 'students':
      query = supabaseClient
        .from('students')
        .select(`
          id,
          last_name,
          first_name,
          date_of_birth,
          gender,
          enrollments (
            class_id,
            classes (
              name
            ),
            status,
            enrollment_date
          ),
          parents (
            father_name,
            mother_name,
            phone
          )
        `)
        .eq('school_id', schoolId);

      if (filters.classId) {
        query = query.contains('enrollments', [{ class_id: filters.classId }]);
      }
      if (filters.status) {
        query = query.contains('enrollments', [{ status: filters.status }]);
      }
      break;

    case 'bulletins':
      query = supabaseClient
        .from('report_cards')
        .select(`
          id,
          student_id,
          students (
            id,
            last_name,
            first_name
          ),
          class_id,
          classes (
            name
          ),
          period_id,
          periods (
            name,
            start_date,
            end_date
          ),
          average,
          rank,
          mention,
          appreciation
        `)
        .eq('school_id', schoolId);

      if (filters.periodId) {
        query = query.eq('period_id', filters.periodId);
      }
      if (filters.classId) {
        query = query.eq('class_id', filters.classId);
      }
      break;

    case 'attendance':
      query = supabaseClient
        .from('attendance_records')
        .select(`
          id,
          student_id,
          students (
            id,
            last_name,
            first_name
          ),
          date,
          status,
          justification,
          attendance_sessions (
            class_id,
            classes (
              name
            )
          )
        `)
        .eq('school_id', schoolId);

      if (filters.dateRange?.start) {
        query = query.gte('date', filters.dateRange.start);
      }
      if (filters.dateRange?.end) {
        query = query.lte('date', filters.dateRange.end);
      }
      break;

    case 'payments':
      query = supabaseClient
        .from('payments')
        .select(`
          id,
          payment_date,
          student_id,
          students (
            id,
            last_name,
            first_name
          ),
          enrollments (
            class_id,
            classes (
              name
            )
          ),
          amount,
          payment_method,
          reference,
          status,
          fee_schedules (
            fee_type
          )
        `)
        .eq('school_id', schoolId);

      if (filters.dateRange?.start) {
        query = query.gte('payment_date', filters.dateRange.start);
      }
      if (filters.dateRange?.end) {
        query = query.lte('payment_date', filters.dateRange.end);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      break;

    case 'payroll':
      query = supabaseClient
        .from('payroll_entries')
        .select(`
          id,
          teacher_id,
          teachers (
            id,
            last_name,
            first_name
          ),
          period,
          base_salary,
          hours_worked,
          hourly_rate,
          gross_salary,
          deductions,
          net_salary,
          status
        `)
        .eq('school_id', schoolId);

      if (filters.period) {
        query = query.eq('period', filters.period);
      }
      if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
      }
      break;

    case 'grades':
      query = supabaseClient
        .from('grades')
        .select(`
          id,
          student_id,
          students (
            id,
            last_name,
            first_name
          ),
          enrollments (
            class_id,
            classes (
              name
            )
          ),
          subject_id,
          subjects (
            name
          ),
          grade_type,
          score,
          max_score,
          coefficient,
          graded_date
        `)
        .eq('school_id', schoolId);

      if (filters.periodId) {
        query = query.eq('period_id', filters.periodId);
      }
      if (filters.subjectId) {
        query = query.eq('subject_id', filters.subjectId);
      }
      break;

    default:
      throw new Error(`Resource type ${resourceType} not yet implemented`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch ${resourceType} data: ${error.message}`);
  }

  return data || [];
}

// Transform data according to template configuration
function transformData(
  data: any[],
  templateConfig: any,
  resourceType: string
): any[] {
  if (!templateConfig.columns || templateConfig.columns.length === 0) {
    return data;
  }

  const visibleColumns = templateConfig.columns.filter((col: any) => col.visible !== false);

  return data.map((row: any) => {
    const transformedRow: any = {};

    visibleColumns.forEach((col: any) => {
      let value = getNestedValue(row, col.key);

      // Apply formatting
      if (col.format) {
        value = formatValue(value, col.format);
      }

      // Use custom header if provided
      const header = col.header || col.key;
      transformedRow[header] = value;
    });

    return transformedRow;
  });
}

// Get nested object value by key path
function getNestedValue(obj: any, key: string): any {
  const keys = key.split('.');
  let value = obj;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return null;
    }
  }

  return value;
}

// Format value based on format type
function formatValue(value: any, format: any): any {
  if (value === null || value === undefined) {
    return '';
  }

  switch (format.type) {
    case 'number':
      return parseFloat(value).toFixed(format.decimals || 2);

    case 'currency':
      return `${format.symbol || ''} ${parseFloat(value).toFixed(2)}`;

    case 'percentage':
      return `${parseFloat(value).toFixed(2)}%`;

    case 'date':
      return new Date(value).toLocaleDateString('fr-FR');

    case 'integer':
      return parseInt(value);

    default:
      return value;
  }
}

// Generate Excel file
async function generateExcel(data: any[], templateConfig: any, resourceType: string): Promise<Uint8Array> {
  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Apply styles if configured
  if (templateConfig.styles) {
    const styles = templateConfig.styles;

    // Get range
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Apply header style
    if (styles.headerColor || styles.headerFont || styles.headerBold) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        if (!worksheet[cellAddress]) continue;

        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: styles.headerColor || '2E7D32' } },
          font: {
            name: styles.headerFont || 'Arial',
            bold: styles.headerBold !== false,
            sz: styles.headerFontSize || 12
          }
        };
      }
    }

    // Apply alternate row colors
    if (styles.alternateRows && styles.alternateRowColor) {
      for (let row = range.s.r + 1; row <= range.e.r; row += 2) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellAddress]) continue;

          worksheet[cellAddress].s = {
            ...worksheet[cellAddress].s,
            fill: { fgColor: { rgb: styles.alternateRowColor } }
          };
        }
      }
    }

    // Set column widths
    if (templateConfig.columns) {
      const colWidths = templateConfig.columns
        .filter((col: any) => col.visible !== false)
        .map((col: any) => ({ wch: col.width || 15 }));

      worksheet['!cols'] = colWidths;
    }
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new Uint8Array(buffer);
}

// Upload file to storage
async function uploadToStorage(
  supabaseClient: any,
  schoolId: string,
  fileName: string,
  buffer: Uint8Array
): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const filePath = `${schoolId}/${year}/${month}/${fileName}`;

  const { data, error } = await supabaseClient
    .storage
    .from('exports')
    .upload(filePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return filePath;
}
