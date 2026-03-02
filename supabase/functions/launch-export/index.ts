// ============================================
// Module Premium - API Export Avancé
// Edge Function: Launch Export (Orchestrator)
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  requireExportApiAccess,
  logExportAction,
  getUserExportSchoolId
} from '../_shared/exportModuleCheck.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LaunchExportRequest {
  templateId?: string;
  templateConfig?: any;
  exportType: 'excel' | 'pdf' | 'csv';
  resourceType: 'bulletins' | 'students' | 'attendance' | 'payments' | 'payroll' | 'grades' | 'schedules' | 'lesson_logs' | 'student_cards' | 'exam_results';
  filters?: Record<string, any>;
}

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

    const {
      templateId,
      templateConfig,
      exportType,
      resourceType,
      filters = {}
    }: LaunchExportRequest = await req.json();

    if (!exportType) throw new Error('exportType is required');
    if (!resourceType) throw new Error('resourceType is required');

    const schoolId = await getUserExportSchoolId(supabaseClient, user.id);
    if (!schoolId) throw new Error('User not associated with any school');

    await requireExportApiAccess(supabaseClient, schoolId);

    // Determine which Edge Function to call based on export type
    const functionMap: Record<string, string> = {
      'excel': 'generate-export-excel',
      'pdf': 'generate-export-pdf',
      'csv': 'generate-export-csv'
    };

    const functionName = functionMap[exportType];
    if (!functionName) {
      throw new Error(`Unsupported export type: ${exportType}`);
    }

    // Call the appropriate Edge Function
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${functionName}`;

    const payload: any = {
      exportType,
      resourceType,
      filters
    };

    if (templateId) {
      payload.templateId = templateId;
    } else if (templateConfig) {
      payload.templateConfig = templateConfig;
    } else {
      throw new Error('Either templateId or templateConfig is required');
    }

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }

    // Log the launch action
    await logExportAction(supabaseClient, schoolId, user.id, 'LAUNCH_EXPORT', {
      job_id: result.jobId,
      export_type: exportType,
      resource_type: resourceType
    });

    return new Response(
      JSON.stringify({
        success: true,
        jobId: result.jobId,
        status: result.status,
        exportType,
        resourceType
      }),
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
