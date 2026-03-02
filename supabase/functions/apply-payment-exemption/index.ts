import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

interface ApplyExemptionRequest {
  studentId: string;
  exemptionType: 'scholarship' | 'discount' | 'exemption' | 'other';
  amount?: number;
  percentage?: number;
  reason: string;
  validFrom: string;
  validUntil?: string;
  appliesToFeeTypes?: string[];
  metadata?: Record<string, unknown>;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    // Verify user has permission (only school_admin)
    const { data: userData } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'school_admin') {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized. Only school admins can apply exemptions.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ApplyExemptionRequest = await req.json();

    // Validate input
    if (!body.studentId || !body.exemptionType || !body.reason || !body.validFrom) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.amount && !body.percentage) {
      return new Response(
        JSON.stringify({ success: false, message: 'Either amount or percentage must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.percentage && (body.percentage < 0 || body.percentage > 100)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Percentage must be between 0 and 100' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify student belongs to the same school
    const { data: student } = await supabase
      .from('students')
      .select('id, school_id, first_name, last_name')
      .eq('id', body.studentId)
      .single();

    if (!student) {
      return new Response(
        JSON.stringify({ success: false, message: 'Student not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (student.school_id !== userData.school_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Student does not belong to your school' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate dates
    const validFrom = new Date(body.validFrom);
    const validUntil = body.validUntil ? new Date(body.validUntil) : null;

    if (isNaN(validFrom.getTime())) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid validFrom date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (validUntil && validUntil <= validFrom) {
      return new Response(
        JSON.stringify({ success: false, message: 'validUntil must be after validFrom' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create exemption record
    const exemptionData = {
      school_id: userData.school_id,
      student_id: body.studentId,
      exemption_type: body.exemptionType,
      amount: body.amount || null,
      percentage: body.percentage || null,
      reason: body.reason,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      valid_from: validFrom.toISOString(),
      valid_until: validUntil?.toISOString() || null,
      applies_to_fee_types: body.appliesToFeeTypes || [],
      is_active: true,
      metadata: body.metadata || {}
    };

    const { data: exemption, error: insertError } = await supabase
      .from('payment_exemptions')
      .insert(exemptionData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting exemption:', insertError);
      throw insertError;
    }

    // The trigger will automatically recalculate fee schedules
    // Fetch updated fee schedules to show the impact
    const { data: feeSchedules } = await supabase
      .from('fee_schedules')
      .select('*, fee_types(name)')
      .eq('student_id', body.studentId)
      .neq('status', 'cancelled')
      .order('due_date');

    // Calculate total discount applied
    const totalDiscount = feeSchedules?.reduce((sum, fs) => sum + (fs.discount_amount || 0), 0) || 0;

    return new Response(
      JSON.stringify({
        success: true,
        exemption,
        impact: {
          feeSchedulesUpdated: feeSchedules?.length || 0,
          totalDiscountApplied: totalDiscount
        },
        message: 'Exemption applied successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error applying payment exemption:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
