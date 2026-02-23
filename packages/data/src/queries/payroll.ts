import { camelToSnakeKeys, snakeToCamelKeys } from '../helpers/transform';
import { getSupabaseClient } from '../client';
import type {
  PayrollPeriod,
  PayrollEntry,
  PayrollEntryWithRelations,
  SalaryComponent,
  PayrollPayment,
  PayrollSlip,
  CreatePayrollPeriodInput,
  UpdatePayrollEntryInput,
  CreateSalaryComponentInput,
  RecordPayrollPaymentInput,
  PayrollFilters,
  TeacherPayrollStats,
  TeacherHoursBreakdown,
  TeacherCurrentMonthEstimate,
} from '@core/schemas/payroll';

// ============================================================================
// PAYROLL PERIODS
// ============================================================================

export const payrollPeriodQueries = {
  async getAll(schoolId: string, academicYearId?: string): Promise<PayrollPeriod[]> {
    let query = getSupabaseClient()
      .from('payroll_periods')
      .select('*')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false });

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ? snakeToCamelKeys(data) as PayrollPeriod[] : [];
  },

  async getById(id: string): Promise<PayrollPeriod> {
    const { data, error } = await getSupabaseClient()
      .from('payroll_periods')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as PayrollPeriod;
  },

  async create(schoolId: string, input: CreatePayrollPeriodInput): Promise<PayrollPeriod> {
    const userId = (await getSupabaseClient().auth.getUser()).data.user?.id;
    const dbInput = camelToSnakeKeys(input);

    const { data, error } = await getSupabaseClient()
      .from('payroll_periods')
      .insert({
        ...dbInput,
        school_id: schoolId,
        created_by: userId,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as PayrollPeriod;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('payroll_periods')
      .delete()
      .eq('id', id)
      .eq('status', 'draft');

    if (error) throw error;
  },

  async validate(id: string): Promise<{ success: boolean; message: string }> {
    const { data, error } = await getSupabaseClient()
      .rpc('validate_payroll_period', { payroll_period_id: id });

    if (error) throw error;
    return data as { success: boolean; message: string };
  },
};

// ============================================================================
// PAYROLL ENTRIES
// ============================================================================

export const payrollEntryQueries = {
  async getByPeriod(periodId: string): Promise<PayrollEntryWithRelations[]> {
    const { data, error } = await getSupabaseClient()
      .from('payroll_entries')
      .select(`
        *,
        teacher:users(id, first_name, last_name, email),
        payroll_period:payroll_periods(*),
        salary_components(*),
        payments:payroll_payments(*),
        slip:payroll_slips(*)
      `)
      .eq('payroll_period_id', periodId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as PayrollEntryWithRelations[] : [];
  },

  async getByTeacher(teacherId: string, filters?: PayrollFilters): Promise<PayrollEntryWithRelations[]> {
    let query = getSupabaseClient()
      .from('payroll_entries')
      .select(`
        *,
        payroll_period:payroll_periods(*),
        salary_components(*),
        payments:payroll_payments(*),
        slip:payroll_slips(*)
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ? snakeToCamelKeys(data) as PayrollEntryWithRelations[] : [];
  },

  async getById(id: string): Promise<PayrollEntryWithRelations> {
    const { data, error } = await getSupabaseClient()
      .from('payroll_entries')
      .select(`
        *,
        teacher:users(id, first_name, last_name, email),
        payroll_period:payroll_periods(*),
        salary_components(*),
        payments:payroll_payments(*),
        slip:payroll_slips(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as PayrollEntryWithRelations;
  },

  async update(input: UpdatePayrollEntryInput): Promise<PayrollEntry> {
    const { id, validatedHours, hourlyRate, primesAmount, retenuesAmount, avancesAmount, notes, metadata } = input;

    // Build explicitly only the allowed fields to avoid sending unexpected/invalid enum values
    const dbUpdates: Record<string, any> = {};
    if (validatedHours !== undefined) dbUpdates['validated_hours'] = validatedHours;
    if (hourlyRate !== undefined) dbUpdates['hourly_rate'] = hourlyRate;
    if (primesAmount !== undefined) dbUpdates['primes_amount'] = primesAmount;
    if (retenuesAmount !== undefined) dbUpdates['retenues_amount'] = retenuesAmount;
    if (avancesAmount !== undefined) dbUpdates['avances_amount'] = avancesAmount;
    if (notes !== undefined) dbUpdates['notes'] = notes;
    if (metadata !== undefined) dbUpdates['metadata'] = metadata;

    const { data, error } = await getSupabaseClient()
      .from('payroll_entries')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as PayrollEntry;
  },

  async updateStatus(id: string, status: 'draft' | 'pending_payment' | 'paid'): Promise<PayrollEntry> {
    const { data, error } = await getSupabaseClient()
      .from('payroll_entries')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as PayrollEntry;
  },
};

// ============================================================================
// SALARY COMPONENTS
// ============================================================================

export const salaryComponentQueries = {
  async create(schoolId: string, input: CreateSalaryComponentInput): Promise<SalaryComponent> {
    const userId = (await getSupabaseClient().auth.getUser()).data.user?.id;
    const dbInput = camelToSnakeKeys(input);

    const { data, error } = await getSupabaseClient()
      .from('salary_components')
      .insert({
        ...dbInput,
        school_id: schoolId,
        added_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as SalaryComponent;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('salary_components')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// PAYROLL PAYMENTS
// ============================================================================

export const payrollPaymentQueries = {
  async record(schoolId: string, input: RecordPayrollPaymentInput): Promise<PayrollPayment> {
    const userId = (await getSupabaseClient().auth.getUser()).data.user?.id;
    const dbInput = camelToSnakeKeys(input);

    // Record the payment
    const { data, error } = await getSupabaseClient()
      .from('payroll_payments')
      .insert({
        ...dbInput,
        school_id: schoolId,
        paid_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Get the payroll entry to check net amount
    const { data: entry } = await getSupabaseClient()
      .from('payroll_entries')
      .select('net_amount, status')
      .eq('id', input.payrollEntryId)
      .single();

    if (entry) {
      // Sum all payments for this entry
      const { data: payments } = await getSupabaseClient()
        .from('payroll_payments')
        .select('amount')
        .eq('payroll_entry_id', input.payrollEntryId);

      const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

      // Only update status to paid if fully paid
      if (totalPaid >= entry.net_amount && entry.status !== 'paid') {
        await payrollEntryQueries.updateStatus(input.payrollEntryId, 'paid');
      } else if (totalPaid < entry.net_amount && entry.status === 'draft') {
        // If partially paid, move to pending_payment
        await payrollEntryQueries.updateStatus(input.payrollEntryId, 'pending_payment');
      }
      // If already paid or in pending_payment, leave as is (trigger handles period status)
    }

    // Auto-generate payroll slip if requested
    const shouldAutoGenerate = input.autoGenerateSlip !== false;
    if (shouldAutoGenerate) {
      try {
        await getSupabaseClient().functions.invoke('generate-payroll-slip', {
          body: {
            payrollEntryId: input.payrollEntryId,
            autoSend: false,
            sendChannels: [],
          },
        });
      } catch (slipError) {
        console.error('Failed to auto-generate payroll slip:', slipError);
        // Don't fail the payment if slip generation fails
      }
    }

    return snakeToCamelKeys(data) as PayrollPayment;
  },

  async getByEntry(entryId: string): Promise<PayrollPayment[]> {
    const { data, error } = await getSupabaseClient()
      .from('payroll_payments')
      .select('*')
      .eq('payroll_entry_id', entryId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as PayrollPayment[] : [];
  },
};

// ============================================================================
// STATS
// ============================================================================

export const payrollStatsQueries = {
  async getTeacherStats(teacherId: string, startDate: string, endDate: string): Promise<TeacherPayrollStats> {
    const { data, error } = await getSupabaseClient()
      .from('payroll_entries')
      .select('validated_hours, net_amount, status, hourly_rate')
      .eq('teacher_id', teacherId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const stats: TeacherPayrollStats = {
      teacherId,
      totalHoursValidated: 0,
      totalEarned: 0,
      totalPaid: 0,
      totalPending: 0,
      averageHourlyRate: 0,
      periodsCount: data?.length || 0,
    };

    let totalRate = 0;
    data?.forEach((entry: any) => {
      const entryCamel = snakeToCamelKeys(entry) as PayrollEntry;
      stats.totalHoursValidated += entryCamel.validatedHours;
      stats.totalEarned += entryCamel.netAmount;

      if (entryCamel.status === 'paid') {
        stats.totalPaid += entryCamel.netAmount;
      } else {
        stats.totalPending += entryCamel.netAmount;
      }

      totalRate += entryCamel.hourlyRate;
    });

    stats.averageHourlyRate = stats.periodsCount > 0 ? totalRate / stats.periodsCount : 0;

    return stats;
  },

  async getTeacherHoursBreakdown(teacherId: string, periodId?: string): Promise<TeacherHoursBreakdown[]> {
    let query: any;

    if (periodId) {
      // If periodId is provided, fetch the period and filter logs by date range
      const { data: period, error: periodError } = await getSupabaseClient()
        .from('payroll_periods')
        .select('id, period_name, start_date, end_date')
        .eq('id', periodId)
        .single();

      if (periodError) throw periodError;
      if (!period) return [];

      // Query lesson_logs with correct column names and filter by date range
      query = getSupabaseClient()
        .from('lesson_logs')
        .select(`
          id,
          duration_minutes,
          class_id,
          subject_id,
          teacher_id,
          status,
          session_date,
          classes(id, name),
          subjects(id, name)
        `)
        .eq('teacher_id', teacherId)
        .eq('status', 'validated')
        .gte('session_date', period.start_date)
        .lte('session_date', period.end_date);

      const { data, error } = await query;

      if (error) throw error;
      if (!data) return [];

      // Get the teacher's hourly rate from payroll_entries
      const { data: rateData } = await getSupabaseClient()
        .from('payroll_entries')
        .select('hourly_rate')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const hourlyRate = rateData?.hourly_rate || 0;

      // Group by class and subject
      const breakdownMap = new Map<string, TeacherHoursBreakdown>();

      data.forEach((log: any) => {
        const logCamel = snakeToCamelKeys(log) as any;
        const className = logCamel.classes?.name || 'Unknown';
        const subjectName = logCamel.subjects?.name || 'Unknown';
        const periodName = period.period_name;

        const key = `${className}-${subjectName}-${periodName}`;

        if (!breakdownMap.has(key)) {
          breakdownMap.set(key, {
            className,
            subjectName,
            periodName,
            totalHours: 0,
            sessionsCount: 0,
            hourlyRate,
            amount: 0,
          });
        }

        const breakdown = breakdownMap.get(key)!;
        // Convert duration_minutes to hours
        breakdown.totalHours += (logCamel.durationMinutes || 0) / 60;
        breakdown.sessionsCount += 1;
        breakdown.amount = breakdown.totalHours * hourlyRate;
      });

      return Array.from(breakdownMap.values());
    } else {
      // If no periodId, get breakdown from all payroll_entries for the teacher
      const { data: entries, error: entriesError } = await getSupabaseClient()
        .from('payroll_entries')
        .select(`
          id,
          hourly_rate,
          teacher_id,
          payroll_period_id,
          payroll_periods!inner(id, period_name, start_date, end_date)
        `)
        .eq('teacher_id', teacherId);

      if (entriesError) throw entriesError;
      if (!entries || entries.length === 0) return [];

      // Fetch lesson_logs for each period
      const allBreakdowns: TeacherHoursBreakdown[] = [];

      for (const entry of entries) {
        const entryCamel = snakeToCamelKeys(entry) as any;
        const period = entryCamel.payrollPeriods;

        const { data: logs } = await getSupabaseClient()
          .from('lesson_logs')
          .select(`
            id,
            duration_minutes,
            class_id,
            subject_id,
            classes(id, name),
            subjects(id, name)
          `)
          .eq('teacher_id', teacherId)
          .eq('status', 'validated')
          .gte('session_date', period.start_date)
          .lte('session_date', period.end_date);

        if (!logs) continue;

        // Group by class and subject for this period
        const breakdownMap = new Map<string, TeacherHoursBreakdown>();

        logs.forEach((log: any) => {
          const logCamel = snakeToCamelKeys(log) as any;
          const className = logCamel.classes?.name || 'Unknown';
          const subjectName = logCamel.subjects?.name || 'Unknown';
          const periodName = period.period_name;

          const key = `${className}-${subjectName}-${periodName}`;

          if (!breakdownMap.has(key)) {
            breakdownMap.set(key, {
              className,
              subjectName,
              periodName,
              totalHours: 0,
              sessionsCount: 0,
              hourlyRate: entryCamel.hourlyRate,
              amount: 0,
            });
          }

          const breakdown = breakdownMap.get(key)!;
          // Convert duration_minutes to hours
          breakdown.totalHours += (logCamel.durationMinutes || 0) / 60;
          breakdown.sessionsCount += 1;
          breakdown.amount = breakdown.totalHours * entryCamel.hourlyRate;
        });

        allBreakdowns.push(...Array.from(breakdownMap.values()));
      }

      return allBreakdowns;
    }
  },

  async getTeacherCurrentMonthHours(teacherId: string): Promise<TeacherCurrentMonthEstimate> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Get all payroll periods for this teacher to exclude dates already in payroll
    const { data: existingPeriods, error: periodsError } = await getSupabaseClient()
      .from('payroll_entries')
      .select(`
        start_date,
        end_date
      `)
      .eq('teacher_id', teacherId)
      .join('payroll_periods!inner', 'payroll_period_id');

    if (periodsError) throw periodsError;

    // Build a list of date ranges to exclude
    const excludedRanges = existingPeriods?.map((p: any) => ({
      start: new Date(p.start_date),
      end: new Date(p.end_date),
    })) || [];

    // Get validated lesson logs for current month
    const { data: lessonData, error: lessonError } = await getSupabaseClient()
      .from('lesson_logs')
      .select('id, duration_minutes, session_date')
      .eq('teacher_id', teacherId)
      .eq('status', 'validated')
      .gte('session_date', startOfMonth)
      .lte('session_date', endOfMonth);

    if (lessonError) throw lessonError;

    // Filter out logs that fall within existing payroll periods
    const filteredLogs = lessonData?.filter((log) => {
      const logDate = new Date(log.session_date);
      // Check if this log's date falls within any existing payroll period
      return !excludedRanges.some(range => logDate >= range.start && logDate <= range.end);
    }) || [];

    // Convert duration_minutes to hours
    const currentMonthHours = filteredLogs.reduce((sum, log) => sum + (log.duration_minutes || 0) / 60, 0);
    const validatedSessionsCount = filteredLogs.length;

    // Get the teacher's last hourly rate
    const { data: rateData } = await getSupabaseClient()
      .from('payroll_entries')
      .select('hourly_rate')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastHourlyRate = rateData?.hourly_rate || 0;
    const estimatedAmount = currentMonthHours * lastHourlyRate;

    // Check if there's an active payroll period for current month
    const { data: periodData } = await getSupabaseClient()
      .from('payroll_periods')
      .select('start_date, end_date')
      .gte('start_date', startOfMonth)
      .lte('end_date', endOfMonth)
      .single();

    return {
      currentMonthHours,
      estimatedAmount,
      lastHourlyRate,
      validatedSessionsCount,
      periodStart: periodData?.start_date || null,
      periodEnd: periodData?.end_date || null,
    };
  },
};
