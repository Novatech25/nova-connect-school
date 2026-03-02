// ============================================
// Module Premium - API Export Avancé
// Edge Function: Download Export
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { jobId } = await req.json();
    if (!jobId) throw new Error('jobId is required');

    // Get export job
    const { data: job, error: jobError } = await supabaseClient
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Export job not found');
    }

    // Verify job status
    if (job.status !== 'completed') {
      throw new Error(`Export is ${job.status}. Please wait until it is completed.`);
    }

    // Check if expired
    if (job.expires_at && new Date(job.expires_at) < new Date()) {
      throw new Error('Export file has expired. Please generate a new export.');
    }

    // Get user's school ID
    const schoolId = await getUserExportSchoolId(supabaseClient, user.id);
    if (!schoolId || schoolId !== job.school_id) {
      throw new Error('You do not have permission to download this export');
    }

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient
      .storage
      .from('exports')
      .createSignedUrl(job.file_path, 3600); // 1 hour expiration

    if (signedUrlError || !signedUrlData) {
      throw new Error('Failed to generate download link');
    }

    // Update last accessed time
    await supabaseClient
      .from('export_jobs')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', jobId);

    // Determine file name
    const fileName = job.file_path.split('/').pop() || `export_${jobId}`;

    return new Response(
      JSON.stringify({
        success: true,
        signedUrl: signedUrlData.signedUrl,
        fileName,
        fileSize: job.file_size_bytes,
        rowCount: job.row_count,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: error.message.includes('permission') ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function getUserExportSchoolId(supabaseClient: any, userId: string): Promise<string | null> {
  const { data: adminData } = await supabaseClient
    .from('school_admins')
    .select('school_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (adminData) return adminData.school_id;

  const { data: accountantData } = await supabaseClient
    .from('school_accountants')
    .select('school_id')
    .eq('user_id', userId)
    .maybeSingle();

  return accountantData?.school_id || null;
}
