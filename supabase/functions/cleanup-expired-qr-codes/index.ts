// Edge Function: Cleanup Expired QR Codes
// Description: Deactivates and optionally deletes expired QR codes
// Should be run periodically via cron job (recommended: every hour)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Configuration
const DELETE_AFTER_DAYS = 30; // Delete QR codes expired for more than 30 days

serve(async (req) => {
  try {
    // Verify request is from cron (should use service role key)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.includes('Bearer')) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const deleteThreshold = new Date(
      now.getTime() - DELETE_AFTER_DAYS * 24 * 60 * 60 * 1000
    );

    let stats = {
      deactivated: 0,
      deleted: 0,
      errors: 0,
    };

    // 1. Deactivate expired QR codes
    const { data: expiredCodes, error: fetchError } = await supabase
      .from('qr_attendance_codes')
      .select('id, school_id, expires_at')
      .eq('is_active', true)
      .lt('expires_at', now.toISOString());

    if (fetchError) {
      console.error('Error fetching expired QR codes:', fetchError);
      throw fetchError;
    }

    if (expiredCodes && expiredCodes.length > 0) {
      // Deactivate all expired codes
      const { error: deactivateError } = await supabase
        .from('qr_attendance_codes')
        .update({ is_active: false })
        .eq('is_active', true)
        .lt('expires_at', now.toISOString());

      if (deactivateError) {
        console.error('Error deactivating QR codes:', deactivateError);
        stats.errors++;
      } else {
        stats.deactivated = expiredCodes.length;

        // Log deactivations in audit_logs
        const auditLogs = expiredCodes.map((code) => ({
          school_id: code.school_id,
          user_id: null, // System action
          action: 'cleanup_deactivate_qr_code',
          resource_type: 'qr_attendance_code',
          resource_id: code.id,
          metadata: {
            reason: 'expired',
            expires_at: code.expires_at,
            cleanup_run_at: now.toISOString(),
          },
        }));

        await supabase.from('audit_logs').insert(auditLogs);
      }
    }

    // 2. Delete old inactive QR codes (expired for more than DELETE_AFTER_DAYS)
    const { data: oldCodes, error: oldFetchError } = await supabase
      .from('qr_attendance_codes')
      .select('id, school_id, expires_at')
      .eq('is_active', false)
      .lt('expires_at', deleteThreshold.toISOString());

    if (oldFetchError) {
      console.error('Error fetching old QR codes:', oldFetchError);
      stats.errors++;
    } else if (oldCodes && oldCodes.length > 0) {
      // Delete old codes
      const { error: deleteError } = await supabase
        .from('qr_attendance_codes')
        .delete()
        .eq('is_active', false)
        .lt('expires_at', deleteThreshold.toISOString());

      if (deleteError) {
        console.error('Error deleting old QR codes:', deleteError);
        stats.errors++;
      } else {
        stats.deleted = oldCodes.length;

        // Log deletions in audit_logs
        const auditLogs = oldCodes.map((code) => ({
          school_id: code.school_id,
          user_id: null, // System action
          action: 'cleanup_delete_qr_code',
          resource_type: 'qr_attendance_code',
          resource_id: code.id,
          metadata: {
            reason: 'expired_and_old',
            expires_at: code.expires_at,
            deleted_after_days: DELETE_AFTER_DAYS,
            cleanup_run_at: now.toISOString(),
          },
        }));

        await supabase.from('audit_logs').insert(auditLogs);
      }
    }

    // 3. Return summary
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed',
        stats,
        timestamp: now.toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in cleanup-expired-qr-codes:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
