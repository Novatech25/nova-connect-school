import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import * as XLSX from 'https://esm.sh/xlsx@latest?target=deno';

interface ExportPayrollExcelRequest {
  payrollPeriodId: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) throw new Error('Invalid authorization token');

    // Verify user is accountant or school_admin
    const { data: userData } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', user.id)
      .single();

    if (!userData || !['school_admin', 'accountant'].includes(userData.role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { payrollPeriodId }: ExportPayrollExcelRequest = await req.json();

    // Get payroll period
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', payrollPeriodId)
      .single();

    if (periodError || !period) throw new Error('Payroll period not found');

    // Get all entries with relations
    const { data: entries, error: entriesError } = await supabase
      .from('payroll_entries')
      .select(`
        *,
        teacher:users(id, first_name, last_name, email),
        salary_components(*)
      `)
      .eq('payroll_period_id', payrollPeriodId)
      .order('created_at', { ascending: false });

    if (entriesError) throw entriesError;

    // Prepare Excel data
    const excelData = entries?.map((entry: any) => {
      const teacher = entry.teacher as any;
      const components = entry.salary_components as any[];

      // Group components by type
      const primes = components
        .filter((c: any) => ['prime', 'bonus'].includes(c.component_type))
        .reduce((sum: number, c: any) => sum + c.amount, 0);
      const retenues = components
        .filter((c: any) => ['retenue', 'deduction'].includes(c.component_type))
        .reduce((sum: number, c: any) => sum + Math.abs(c.amount), 0);
      const avances = components
        .filter((c: any) => c.component_type === 'avance')
        .reduce((sum: number, c: any) => sum + Math.abs(c.amount), 0);

      return {
        'Enseignant': `${teacher.first_name} ${teacher.last_name}`,
        'Email': teacher.email,
        'Heures Validées': entry.validated_hours,
        'Taux Horaire': entry.hourly_rate,
        'Montant Base': entry.base_amount,
        'Primes': primes,
        'Retenues': retenues,
        'Avances': avances,
        'Montant Brut': entry.gross_amount,
        'Montant Net': entry.net_amount,
        'Statut': entry.status,
      };
    }) || [];

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Enseignant
      { wch: 30 }, // Email
      { wch: 15 }, // Heures Validées
      { wch: 12 }, // Taux Horaire
      { wch: 12 }, // Montant Base
      { wch: 10 }, // Primes
      { wch: 10 }, // Retenues
      { wch: 10 }, // Avances
      { wch: 12 }, // Montant Brut
      { wch: 12 }, // Montant Net
      { wch: 12 }, // Statut
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Paie');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    // Create filename
    const filename = `paie_${period.period_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Return file
    return new Response(excelBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('Error exporting payroll:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
