import { getSupabaseClient } from '../client';
import {
  camelToSnakeKeys,
  snakeToCamelKeys,
  gatewayRequest,
  getSyncStrategy,
  runWithStrategy,
} from '../helpers';
import type {
  FeeType,
  FeeSchedule,
  Payment,
  PaymentReceipt,
  PaymentReminder,
  PaymentExemption,
  CreateFeeTypeInput,
  UpdateFeeTypeInput,
  CreateFeeScheduleInput,
  UpdateFeeScheduleInput,
  RecordPaymentInput,
  ApplyExemptionInput,
  UpdateExemptionInput,
  SendReminderInput,
  PaymentFilters,
  StudentBalance,
  PaymentStats,
} from '@core/schemas/payments';

const supabase = getSupabaseClient();

// ============================================================================
// FEE TYPES QUERIES
// ============================================================================

export const feeTypeQueries = {
  /**
   * Get all fee types for a school
   */
  async getAll(schoolId: string): Promise<FeeType[]> {
    const { data, error } = await supabase
      .from('fee_types')
      .select('*')
      .eq('school_id', schoolId)
      .order('name');

    if (error) throw error;
    return snakeToCamelKeys(data) as FeeType[];
  },

  /**
   * Get a single fee type by ID
   */
  async getById(id: string): Promise<FeeType> {
    const { data, error } = await supabase
      .from('fee_types')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as FeeType;
  },

  /**
   * Create a new fee type
   */
  async create(input: CreateFeeTypeInput & { schoolId: string }): Promise<FeeType> {
    const { data, error } = await supabase
      .from('fee_types')
      .insert(camelToSnakeKeys(input))
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as FeeType;
  },

  /**
   * Update a fee type
   */
  async update(id: string, input: UpdateFeeTypeInput): Promise<FeeType> {
    const { data, error } = await supabase
      .from('fee_types')
      .update(camelToSnakeKeys(input))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as FeeType;
  },

  /**
   * Delete a fee type
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('fee_types')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// FEE SCHEDULES QUERIES
// ============================================================================

export const feeScheduleQueries = {
  /**
   * Get all fee schedules with optional filters
   */
  async getAll(filters: PaymentFilters): Promise<FeeSchedule[]> {
    let query = supabase
      .from('fee_schedules')
      .select(`
        *,
        student:students(id, first_name, last_name, matricule),
        fee_type:fee_types(*),
        academic_year:academic_years(id, name)
      `)
      .order('due_date');

    if (filters.schoolId) {
      query = query.eq('school_id', filters.schoolId);
    }

    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    if (filters.academicYearId) {
      query = query.eq('academic_year_id', filters.academicYearId);
    }

    if (filters.feeTypeId) {
      query = query.eq('fee_type_id', filters.feeTypeId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return snakeToCamelKeys(data) as FeeSchedule[];
  },

  /**
   * Get fee schedules for a student
   */
  async getByStudent(studentId: string, academicYearId: string): Promise<FeeSchedule[]> {
    const { data, error } = await supabase
      .from('fee_schedules')
      .select(`
        *,
        fee_type:fee_types(*)
      `)
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .neq('status', 'cancelled')
      .order('due_date');

    if (error) throw error;
    return snakeToCamelKeys(data) as FeeSchedule[];
  },

  /**
   * Get a single fee schedule by ID
   */
  async getById(id: string): Promise<FeeSchedule> {
    const { data, error } = await supabase
      .from('fee_schedules')
      .select(`
        *,
        student:students(id, first_name, last_name, matricule),
        fee_type:fee_types(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as FeeSchedule;
  },

  /**
   * Create a new fee schedule
   */
  async create(input: CreateFeeScheduleInput & { schoolId?: string }): Promise<FeeSchedule> {
    const { data, error } = await supabase
      .from('fee_schedules')
      .insert(camelToSnakeKeys(input))
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as FeeSchedule;
  },

  /**
   * Update a fee schedule
   */
  async update(id: string, input: UpdateFeeScheduleInput): Promise<FeeSchedule> {
    const { data, error } = await supabase
      .from('fee_schedules')
      .update(camelToSnakeKeys(input))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as FeeSchedule;
  },

  /**
   * Delete a fee schedule
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('fee_schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// PAYMENTS QUERIES
// ============================================================================

export const paymentQueries = {
  /**
   * Get all payments with optional filters
   */
  async getAll(filters: PaymentFilters): Promise<Payment[]> {
    let query = supabase
      .from('payments')
      .select(`
        *,
        student:students(id, first_name, last_name, matricule),
        fee_schedule:fee_schedules(*, fee_type:fee_types(*))
      `)
      .order('payment_date', { ascending: false });

    if (filters.schoolId) {
      query = query.eq('school_id', filters.schoolId);
    }

    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    // Filtrage par année scolaire via fee_schedule
    if (filters.academicYearId) {
      query = query.eq('fee_schedule.academic_year_id', filters.academicYearId);
    }

    if (filters.dateFrom) {
      query = query.gte('payment_date', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('payment_date', filters.dateTo);
    }

    if (filters.paymentMethod) {
      query = query.eq('payment_method', filters.paymentMethod);
    }

    const { data, error } = await query;

    if (error) throw error;
    return snakeToCamelKeys(data) as Payment[];
  },

  /**
   * Get payments for a student
   */
  async getByStudent(studentId: string, academicYearId?: string): Promise<Payment[]> {
    let query = supabase
      .from('payments')
      .select(`
        *,
        fee_schedule:fee_schedules!left(*, fee_type:fee_types(*))
      `)
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false });

    // Si on veut filtrer strictement par année académique, il faudrait faire un inner join sur fee_schedules
    // Mais pour l'affichage parent, on veut généralement voir tous les paiements récents, ou alors filtrer côté client.
    // Le problème signalé est que le paiement n'apparait pas.
    // Cela peut être dû au fait que le paiement a été créé SANS fee_schedule_id (paiement libre/avance)
    // ou que la jointure échoue si fee_schedule est null.
    // L'ajout de !left (left join explicite) peut aider si ce n'est pas le défaut.

    const { data, error } = await query;

    if (error) throw error;

    // Filtrage post-query si academicYearId est fourni et pertinent
    let payments = snakeToCamelKeys(data) as Payment[];
    if (academicYearId) {
      payments = payments.filter(p => !p.feeSchedule || p.feeSchedule.academicYearId === academicYearId);
    }

    return payments;
  },

  /**
   * Get a single payment by ID
   */
  async getById(id: string): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        student:students(id, first_name, last_name, matricule),
        fee_schedule:fee_schedules(*, fee_type:fee_types(*))
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as Payment;
  },

  /**
   * Record a new payment
   */
  async create(input: RecordPaymentInput & { schoolId: string; receivedBy: string; autoGenerateReceipt?: boolean }): Promise<Payment> {
    const { autoGenerateReceipt = true, ...payload } = input;
    const { data, error } = await supabase
      .from('payments')
      .insert(camelToSnakeKeys(payload))
      .select()
      .single();

    if (error) throw error;
    const payment = snakeToCamelKeys(data) as Payment;

    // Auto-generate receipt if requested
    if (autoGenerateReceipt) {
      try {
        await supabase.functions.invoke('generate-payment-receipt', {
          body: {
            paymentId: payment.id,
            autoSend: false, // Don't auto-send by default
            sendChannels: [],
          },
        });
      } catch (receiptError) {
        console.error('Failed to auto-generate receipt:', receiptError);
        // Don't fail the payment if receipt generation fails
      }
    }

    return payment;
  },
};

// ============================================================================
// PAYMENT EXEMPTIONS QUERIES
// ============================================================================

export const paymentExemptionQueries = {
  /**
   * Get all exemptions with optional filters
   */
  async getAll(schoolId: string, studentId?: string): Promise<PaymentExemption[]> {
    let query = supabase
      .from('payment_exemptions')
      .select(`
        *,
        student:students(id, first_name, last_name, matricule),
        approver:users(id, first_name, last_name)
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return snakeToCamelKeys(data) as PaymentExemption[];
  },

  /**
   * Get a single exemption by ID
   */
  async getById(id: string): Promise<PaymentExemption> {
    const { data, error } = await supabase
      .from('payment_exemptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as PaymentExemption;
  },

  /**
   * Apply a new exemption
   */
  async create(input: ApplyExemptionInput & { schoolId: string; approvedBy: string }): Promise<PaymentExemption> {
    const strategy = getSyncStrategy();

    const createInSupabase = async () => {
      const { data, error } = await supabase
        .from('payment_exemptions')
        .insert(camelToSnakeKeys(input))
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as PaymentExemption;
    };

    const createInGateway = async () => {
      const data = await gatewayRequest(
        '/payment-exemptions',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
        supabase,
        input.schoolId
      );

      return snakeToCamelKeys(data) as PaymentExemption;
    };

    return runWithStrategy({
      strategy,
      gateway: createInGateway,
      supabase: createInSupabase,
    });
  },

  /**
   * Update an exemption
   */
  async update(id: string, input: UpdateExemptionInput): Promise<PaymentExemption> {
    const { data, error } = await supabase
      .from('payment_exemptions')
      .update(camelToSnakeKeys(input))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as PaymentExemption;
  },

  /**
   * Revoke an exemption
   */
  async revoke(id: string): Promise<void> {
    const { error } = await supabase
      .from('payment_exemptions')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// STUDENT BALANCE QUERIES
// ============================================================================

export const balanceQueries = {
  /**
   * Get student balance for an academic year
   */
  async getStudentBalance(studentId: string, academicYearId: string): Promise<StudentBalance> {
    const { data, error } = await supabase.rpc('calculate_student_balance', {
      p_student_id: studentId,
      p_academic_year_id: academicYearId
    });

    if (error) throw error;
    return data as StudentBalance;
  },

  /**
   * Get payment statistics for a school
   */
  async getPaymentStats(schoolId: string, academicYearId: string): Promise<PaymentStats> {
    // Get total collected
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('school_id', schoolId);

    const totalCollected = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // Get total pending and overdue
    const { data: schedules } = await supabase
      .from('fee_schedules')
      .select('amount, paid_amount, remaining_amount')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)
      .neq('status', 'cancelled');

    const totalDue = schedules?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0;
    const totalPaid = schedules?.reduce((sum, s) => sum + (s.paid_amount || 0), 0) || 0;
    const totalPending = schedules?.reduce((sum, s) => sum + (s.remaining_amount || 0), 0) || 0;

    const totalOverdue = schedules?.reduce((sum, s) => {
      if (s.status === 'overdue') {
        return sum + (s.remaining_amount || 0);
      }
      return sum;
    }, 0) || 0;

    const collectionRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

    return {
      total_collected: totalCollected,
      total_pending: totalPending,
      total_overdue: totalOverdue,
      collection_rate: collectionRate,
      payment_count: payments?.length || 0,
    };
  },
};

// ============================================================================
// EDGE FUNCTION INVOCATIONS
// ============================================================================

export const paymentEdgeFunctions = {
  /**
   * Generate a payment receipt
   */
  async generateReceipt(paymentId: string): Promise<any> {
    const getAccessToken = async (): Promise<string | undefined> => {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;

      if (!token && typeof window !== 'undefined') {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
        if (projectRef) {
          const stored = window.localStorage.getItem(`sb-${projectRef}-auth-token`);
          if (stored) {
            try {
              token = JSON.parse(stored)?.access_token;
            } catch {
              token = undefined;
            }
          }
        }
      }

      if (!token) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed?.session?.access_token;
      }

      return token;
    };

    const token = await getAccessToken();
    if (!token || token.split('.').length !== 3) {
      throw new Error('Session invalide. Veuillez vous reconnecter.');
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    if (supabaseUrl && supabaseAnonKey) {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-payment-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'x-user-token': token,
        },
        body: JSON.stringify({ paymentId }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Erreur Edge Function');
      }

      return await response.json();
    }

    const { data, error } = await supabase.functions.invoke('generate-payment-receipt', {
      body: { paymentId },
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        'x-user-token': token,
      },
    });

    if (error) throw error;
    return data;
  },

  /**
   * Send payment reminders
   */
  async sendReminders(input: {
    schoolId?: string;
    studentIds?: string[];
    reminderType?: 'first' | 'second' | 'final' | 'custom';
    dryRun?: boolean;
  }): Promise<any> {
    const { data, error } = await supabase.functions.invoke('send-payment-reminders', {
      body: input
    });

    if (error) throw error;
    return data;
  },

  /**
   * Apply a payment exemption
   */
  async applyExemption(input: ApplyExemptionInput): Promise<any> {
    const { data, error } = await supabase.functions.invoke('apply-payment-exemption', {
      body: input
    });

    if (error) throw error;
    return data;
  },
};
