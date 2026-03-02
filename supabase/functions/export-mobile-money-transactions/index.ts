// ============================================================================
// Edge Function: Export Mobile Money Transactions
// ============================================================================
// Exports transactions to CSV/Excel format with filtering options
// Used by accountants for reporting and reconciliation
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Create authenticated Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // 2. Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request
    const { filters, format = 'csv' } = await req.json();

    // 4. Create service role client for privileged operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Get user's school_id and role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('school_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.school_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with a school' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Verify user has required role (accountant or school_admin)
    if (userData.role !== 'accountant' && userData.role !== 'school_admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only accountants and school admins can export transactions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schoolId = userData.school_id;

    // Build query with filters
    let query = supabase
      .from('mobile_money_transactions')
      .select(`
        *,
        mobile_money_providers (
          provider_code,
          provider_name
        ),
        students (
          first_name,
          last_name,
          student_id
        ),
        payments (
          receipt_number,
          payment_date
        ),
        fee_schedules (
          fee_type
        )
      `)
      .eq('school_id', schoolId)
      .order('initiated_at', { ascending: false });

    // Apply filters
    if (filters) {
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.provider_code) {
        query = query.eq('mobile_money_providers.provider_code', filters.provider_code);
      }
      if (filters.date_from) {
        query = query.gte('initiated_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('initiated_at', filters.date_to);
      }
      if (filters.student_id) {
        query = query.eq('student_id', filters.student_id);
      }
    }

    const { data: transactions, error } = await query;

    if (error) throw error;

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No transactions found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate CSV
    const headers = [
      'Référence',
      'Date',
      'Élève',
      'ID Élève',
      'Fournisseur',
      'Montant',
      'Devise',
      'Statut',
      'Statut Réconciliation',
      'Numéro de téléphone',
      'ID Externe',
      'Reçu',
      'Type de frais'
    ];

    const rows = transactions.map(t => [
      t.transaction_reference,
      new Date(t.initiated_at).toLocaleString('fr-FR'),
      `${t.students?.first_name || ''} ${t.students?.last_name || ''}`.trim(),
      t.students?.student_id || '',
      t.mobile_money_providers?.provider_name || '',
      t.amount?.toString() || '',
      t.currency || '',
      t.status || '',
      t.reconciliation_status || '',
      t.phone_number || '',
      t.external_transaction_id || '',
      t.payments?.receipt_number || '',
      t.fee_schedules?.fee_type || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `mobile-money-transactions-${timestamp}.csv`;

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error: any) {
    console.error('Error exporting transactions:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
