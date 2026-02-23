import { createClient } from "@supabase/supabase-js";

// Ultra-simple direct update function using Service Role to bypass RLS
export async function publishScheduleDirect(scheduleId: string) {
  console.log('DIRECT: Attempting direct publish with Service Role for schedule', scheduleId); // DEBUG

  try {
    // Use Service Role to bypass RLS policies
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Direct SQL update without RLS restrictions
    // Allow publishing from 'draft' or republishing from 'published' status
    const { data, error } = await supabaseService
      .from('schedules')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', scheduleId)
      .in('status', ['draft', 'published']) // Allow both draft and published (for republishing)
      .select();

    if (error) {
      console.error('DIRECT: Service Role update error', error); // DEBUG
      throw new Error(`Direct publish failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.warn('DIRECT: No rows updated - schedule not found'); // DEBUG
      throw new Error('Schedule not found');
    }

    console.log('DIRECT: Successfully published schedule with Service Role', data[0]); // DEBUG

    return {
      success: true,
      schedule: data[0],
      sessionsCreated: 0 // We don't create sessions in this direct method
    };
  } catch (error: any) {
    console.error('DIRECT: Service Role exception', error); // DEBUG
    throw error;
  }
}