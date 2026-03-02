import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireImportApiAccess } from "../_shared/importModuleCheck.ts";

serve(async (req) => {
  try {
    const { importJobId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get import job
    const { data: importJob, error: jobError } = await supabaseClient
      .from('import_jobs')
      .select('*')
      .eq('id', importJobId)
      .single();

    if (jobError || !importJob) {
      return new Response(
        JSON.stringify({ error: 'Import job not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!importJob.can_rollback || importJob.status !== 'completed') {
      return new Response(
        JSON.stringify({ error: 'This import cannot be rolled back' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check premium access
    await requireImportApiAccess(supabaseClient, importJob.school_id);

    // Get import history in reverse order
    const { data: history } = await supabaseClient
      .from('import_history')
      .select('*')
      .eq('import_job_id', importJobId)
      .order('created_at', { ascending: false });

    if (!history || history.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No import history found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process each entry in reverse
    for (const entry of history) {
      if (entry.action === 'created') {
        // Delete the entity
        if (entry.entity_type === 'student') {
          await supabaseClient.from('students').delete().eq('id', entry.entity_id);
        } else if (entry.entity_type === 'grade') {
          await supabaseClient.from('grades').delete().eq('id', entry.entity_id);
        } else if (entry.entity_type === 'schedule_slot') {
          await supabaseClient.from('schedule_slots').delete().eq('id', entry.entity_id);
        }
      } else if (entry.action === 'updated') {
        // Restore original data
        if (entry.entity_type === 'student') {
          await supabaseClient
            .from('students')
            .update(entry.original_data)
            .eq('id', entry.entity_id);
        } else if (entry.entity_type === 'grade') {
          await supabaseClient
            .from('grades')
            .update(entry.original_data)
            .eq('id', entry.entity_id);
        }
      }
      // 'skipped' entries require no action
    }

    // Update import job
    await supabaseClient
      .from('import_jobs')
      .update({
        status: 'rolled_back',
        rolled_back_at: new Date().toISOString(),
        can_rollback: false
      })
      .eq('id', importJobId);

    return new Response(
      JSON.stringify({ success: true, message: 'Import rolled back successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error rolling back import:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
