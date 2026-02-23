// ============================================================================
// Mobile Money Queries
// ============================================================================
// Database queries and Edge Function calls for Mobile Money operations
// ============================================================================

import { getSupabaseClient } from '../client';
import type {
  MobileMoneyProvider,
  MobileMoneyTransaction,
  CreateMobileMoneyProviderInput,
  UpdateMobileMoneyProviderInput,
  InitiateMobileMoneyPaymentInput,
  ReconcileTransactionInput,
  CheckTransactionStatusInput,
  MobileMoneyFilters,
  MobileMoneyKpis
} from '@nova-connect/core';

// ============================================================================
// Provider Queries
// ============================================================================

/**
 * Get all active Mobile Money providers for a school
 */
export async function getProviders(schoolId: string): Promise<MobileMoneyProvider[]> {
  const { data, error } = await getSupabaseClient()
    .from('mobile_money_providers')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('provider_name');

  if (error) throw error;
  return data || [];
}

/**
 * Get a specific provider by ID
 */
export async function getProviderById(id: string): Promise<MobileMoneyProvider | null> {
  const { data, error } = await getSupabaseClient()
    .from('mobile_money_providers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get a provider by code for a specific school
 */
export async function getProviderByCode(
  schoolId: string,
  providerCode: string
): Promise<MobileMoneyProvider | null> {
  const { data, error } = await getSupabaseClient()
    .from('mobile_money_providers')
    .select('*')
    .eq('school_id', schoolId)
    .eq('provider_code', providerCode)
    .eq('is_active', true)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new Mobile Money provider
 */
export async function createProvider(
  input: CreateMobileMoneyProviderInput
): Promise<MobileMoneyProvider> {
  // Encrypt sensitive data before inserting (in production, use proper encryption)
  const { api_key, api_secret, ...rest } = input;

  const { data, error } = await getSupabaseClient()
    .from('mobile_money_providers')
    .insert({
      ...rest,
      api_key_encrypted: api_key,
      api_secret_encrypted: api_secret
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a Mobile Money provider
 */
export async function updateProvider(
  id: string,
  input: UpdateMobileMoneyProviderInput
): Promise<MobileMoneyProvider> {
  const updateData: any = { ...input };

  // Handle encryption if credentials are being updated
  if (input.api_key) {
    updateData.api_key_encrypted = input.api_key;
    delete updateData.api_key;
  }

  if (input.api_secret) {
    updateData.api_secret_encrypted = input.api_secret;
    delete updateData.api_secret;
  }

  const { data, error } = await getSupabaseClient()
    .from('mobile_money_providers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Toggle provider active status
 */
export async function toggleProvider(
  id: string,
  isActive: boolean
): Promise<MobileMoneyProvider> {
  const { data, error } = await getSupabaseClient()
    .from('mobile_money_providers')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a provider
 */
export async function deleteProvider(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('mobile_money_providers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// Transaction Queries
// ============================================================================

/**
 * Get transactions with filters and pagination
 */
export async function getTransactions(
  filters: MobileMoneyFilters,
  page = 1,
  limit = 20
): Promise<{ transactions: MobileMoneyTransaction[]; count: number }> {
  let query = getSupabaseClient()
    .from('mobile_money_transactions')
    .select(`
      *,
      mobile_money_providers (
        id,
        provider_code,
        provider_name
      ),
      students (
        id,
        first_name,
        last_name
      ),
      payments (
        id,
        receipt_number
      )
    `, { count: 'exact' });

  // Apply filters
  if (filters.school_id) {
    query = query.eq('school_id', filters.school_id);
  }

  if (filters.student_id) {
    query = query.eq('student_id', filters.student_id);
  }

  if (filters.provider_id) {
    query = query.eq('provider_id', filters.provider_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.reconciliation_status) {
    query = query.eq('reconciliation_status', filters.reconciliation_status);
  }

  if (filters.date_from) {
    query = query.gte('initiated_at', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('initiated_at', filters.date_to);
  }

  if (filters.phone_number) {
    query = query.eq('phone_number', filters.phone_number);
  }

  if (filters.search) {
    query = query.or(`transaction_reference.ilike.%${filters.search}%,external_transaction_id.ilike.%${filters.search}%`);
  }

  // Apply pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query
    .order('initiated_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    transactions: data || [],
    count: count || 0
  };
}

/**
 * Get a specific transaction by ID
 */
export async function getTransactionById(
  id: string
): Promise<MobileMoneyTransaction | null> {
  const { data, error } = await getSupabaseClient()
    .from('mobile_money_transactions')
    .select(`
      *,
      mobile_money_providers (*),
      students (*),
      payments (*),
      fee_schedules (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get transactions for a specific student
 */
export async function getTransactionsByStudent(
  studentId: string,
  academicYearId?: string
): Promise<MobileMoneyTransaction[]> {
  let query = getSupabaseClient()
    .from('mobile_money_transactions')
    .select(`
      *,
      mobile_money_providers (*),
      payments (*),
      fee_schedules (*)
    `)
    .eq('student_id', studentId)
    .order('initiated_at', { ascending: false });

  if (academicYearId) {
    query = query.eq('fee_schedules.academic_year_id', academicYearId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get fee schedules for a specific student
 */
export async function getStudentFeeSchedules(
  studentId: string
): Promise<any[]> {
  const { data, error } = await getSupabaseClient()
    .from('fee_schedules')
    .select('*')
    .eq('student_id', studentId)
    .in('status', ['pending', 'partial'])
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get pending transactions for reconciliation
 */
export async function getPendingTransactions(
  schoolId: string
): Promise<MobileMoneyTransaction[]> {
  const { data, error } = await getSupabaseClient()
    .from('mobile_money_transactions')
    .select(`
      *,
      students (*),
      mobile_money_providers (*)
    `)
    .eq('school_id', schoolId)
    .eq('status', 'success')
    .eq('reconciliation_status', 'pending')
    .order('initiated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get failed transactions
 */
export async function getFailedTransactions(
  schoolId: string
): Promise<MobileMoneyTransaction[]> {
  const { data, error } = await getSupabaseClient()
    .from('mobile_money_transactions')
    .select(`
      *,
      students (*),
      mobile_money_providers (*)
    `)
    .eq('school_id', schoolId)
    .eq('status', 'failed')
    .order('initiated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get transactions pending status check (initiated but expired or old)
 */
export async function getTransactionsPendingCheck(
  schoolId: string
): Promise<MobileMoneyTransaction[]> {
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  const { data, error } = await getSupabaseClient()
    .from('mobile_money_transactions')
    .select('*')
    .eq('school_id', schoolId)
    .in('status', ['initiated', 'pending'])
    .gte('initiated_at', tenMinutesAgo)
    .order('initiated_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ============================================================================
// Edge Function Calls
// ============================================================================

/**
 * Initiate a Mobile Money payment
 */
export async function initiatePayment(
  input: InitiateMobileMoneyPaymentInput
): Promise<any> {
  const { data, error } = await getSupabaseClient().functions.invoke(
    'initiate-mobile-money-payment',
    {
      body: input
    }
  );

  if (error) throw error;
  return data;
}

/**
 * Check transaction status
 */
export async function checkTransactionStatus(
  input: CheckTransactionStatusInput
): Promise<any> {
  const { data, error } = await getSupabaseClient().functions.invoke(
    'check-mobile-money-status',
    {
      body: input
    }
  );

  if (error) throw error;
  return data;
}

/**
 * Reconcile a transaction manually
 */
export async function reconcileManually(
  input: ReconcileTransactionInput
): Promise<any> {
  const { data, error } = await getSupabaseClient().functions.invoke(
    'reconcile-mobile-money-manual',
    {
      body: input
    }
  );

  if (error) throw error;
  return data;
}

/**
 * Retry a failed transaction
 */
export async function retryTransaction(
  transactionId: string
): Promise<any> {
  const { data, error } = await getSupabaseClient().functions.invoke(
    'retry-failed-mobile-money-transaction',
    {
      body: { transaction_id: transactionId }
    }
  );

  if (error) throw error;
  return data;
}

/**
 * Test a provider connection
 */
export async function testProvider(
  providerId: string
): Promise<any> {
  const { data, error } = await getSupabaseClient().functions.invoke(
    'test-mobile-money-provider',
    {
      body: { provider_id: providerId }
    }
  );

  if (error) throw error;
  return data;
}

// ============================================================================
// KPI Queries
// ============================================================================

/**
 * Get Mobile Money KPIs for a school
 */
export async function getMobileMoneyKpis(
  schoolId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<MobileMoneyKpis> {
  // Build query with date filters
  let query = getSupabaseClient()
    .from('mobile_money_transactions')
    .select('*')
    .eq('school_id', schoolId);

  if (dateFrom) {
    query = query.gte('initiated_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('initiated_at', dateTo);
  }

  const { data: transactions, error } = await query;

  if (error) throw error;

  const totalTransactions = transactions?.length || 0;
  const successTransactions = transactions?.filter(t => t.status === 'success') || [];
  const failedTransactions = transactions?.filter(t => t.status === 'failed') || [];
  const pendingTransactions = transactions?.filter(t => t.status === 'pending') || [];

  const totalAmount = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
  const successAmount = successTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  const successRate = totalTransactions > 0
    ? (successTransactions.length / totalTransactions) * 100
    : 0;

  const averageAmount = totalTransactions > 0
    ? totalAmount / totalTransactions
    : 0;

  // Average processing time (for completed transactions)
  const completedWithTime = successTransactions
    .filter(t => t.initiated_at && t.completed_at)
    .map(t => ({
      start: new Date(t.initiated_at).getTime(),
      end: new Date(t.completed_at).getTime()
    }));

  const averageProcessingTime = completedWithTime.length > 0
    ? completedWithTime.reduce((sum, t) => sum + (t.end - t.start), 0) / completedWithTime.length / 1000
    : 0;

  // Auto-reconciliation rate
  const autoReconciled = transactions?.filter(t =>
    t.reconciliation_status === 'reconciled' && t.metadata?.auto_reconciled
  ).length || 0;

  const totalReconciled = transactions?.filter(t => t.reconciliation_status === 'reconciled').length || 0;

  const autoReconciliationRate = totalReconciled > 0
    ? (autoReconciled / totalReconciled) * 100
    : 0;

  // Provider breakdown
  const providerMap = new Map<string, any>();
  transactions?.forEach(t => {
    const code = t.mobile_money_providers?.provider_code || 'unknown';
    if (!providerMap.has(code)) {
      providerMap.set(code, {
        provider_code: code,
        provider_name: t.mobile_money_providers?.provider_name || code,
        total_transactions: 0,
        total_amount: 0,
        success_count: 0
      });
    }
    const provider = providerMap.get(code);
    provider.total_transactions++;
    provider.total_amount += t.amount || 0;
    if (t.status === 'success') {
      provider.success_count++;
    }
  });

  const providerBreakdown = Array.from(providerMap.values()).map(p => ({
    ...p,
    success_rate: p.total_transactions > 0
      ? (p.success_count / p.total_transactions) * 100
      : 0
  }));

  // Daily volume (last 30 days)
  const dailyVolumeMap = new Map<string, { count: number; amount: number }>();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  transactions?.forEach(t => {
    const date = new Date(t.initiated_at).toISOString().split('T')[0];
    if (!dailyVolumeMap.has(date)) {
      dailyVolumeMap.set(date, { count: 0, amount: 0 });
    }
    const day = dailyVolumeMap.get(date)!;
    day.count++;
    day.amount += t.amount || 0;
  });

  const dailyVolume = Array.from(dailyVolumeMap.entries())
    .map(([date, data]) => ({
      date,
      count: data.count,
      amount: data.amount
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total_transactions: totalTransactions,
    total_amount: totalAmount,
    success_rate: successRate,
    pending_transactions: pendingTransactions.length,
    failed_transactions: failedTransactions.length,
    average_amount: averageAmount,
    average_processing_time_seconds: averageProcessingTime,
    auto_reconciliation_rate: autoReconciliationRate,
    provider_breakdown: providerBreakdown,
    daily_volume: dailyVolume
  };
}

/**
 * Get Mobile Money KPIs for super admin (all schools)
 */
export async function getGlobalMobileMoneyKpis(
  dateFrom?: string,
  dateTo?: string
): Promise<GlobalMobileMoneyKpis> {
  // Build query with date filters
  let query = getSupabaseClient()
    .from('mobile_money_transactions')
    .select(`
      *,
      schools (
        id,
        name,
        code
      ),
      mobile_money_providers (
        provider_code,
        provider_name
      )
    `);

  if (dateFrom) {
    query = query.gte('initiated_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('initiated_at', dateTo);
  }

  const { data: transactions, error } = await query;

  if (error) throw error;

  const totalTransactions = transactions?.length || 0;
  const successTransactions = transactions?.filter(t => t.status === 'success') || [];
  const failedTransactions = transactions?.filter(t => t.status === 'failed') || [];

  const totalAmount = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
  const successAmount = successTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  const successRate = totalTransactions > 0
    ? (successTransactions.length / totalTransactions) * 100
    : 0;

  // Unique schools
  const uniqueSchools = new Set(transactions?.map(t => t.school_id) || []).size;

  // Provider breakdown
  const providerMap = new Map<string, any>();
  transactions?.forEach(t => {
    const code = t.mobile_money_providers?.provider_code || 'unknown';
    if (!providerMap.has(code)) {
      providerMap.set(code, {
        provider_code: code,
        provider_name: t.mobile_money_providers?.provider_name || code,
        total_transactions: 0,
        total_amount: 0,
        success_count: 0
      });
    }
    const provider = providerMap.get(code);
    provider.total_transactions++;
    provider.total_amount += t.amount || 0;
    if (t.status === 'success') {
      provider.success_count++;
    }
  });

  const providerBreakdown = Array.from(providerMap.values()).map(p => ({
    ...p,
    success_rate: p.total_transactions > 0
      ? (p.success_count / p.total_transactions) * 100
      : 0
  }));

  // Top schools by volume
  const schoolMap = new Map<string, any>();
  transactions?.forEach(t => {
    if (!schoolMap.has(t.school_id)) {
      schoolMap.set(t.school_id, {
        school_id: t.school_id,
        school_name: t.schools?.name || 'Unknown',
        total_transactions: 0,
        total_amount: 0
      });
    }
    const school = schoolMap.get(t.school_id);
    school.total_transactions++;
    school.total_amount += t.amount || 0;
  });

  const topSchools = Array.from(schoolMap.values())
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, 10);

  // Trend data (last 7 days)
  const dailyTrendMap = new Map<string, { count: number; amount: number; success_count: number }>();
  transactions?.forEach(t => {
    const date = new Date(t.initiated_at).toISOString().split('T')[0];
    if (!dailyTrendMap.has(date)) {
      dailyTrendMap.set(date, { count: 0, amount: 0, success_count: 0 });
    }
    const day = dailyTrendMap.get(date)!;
    day.count++;
    day.amount += t.amount || 0;
    if (t.status === 'success') {
      day.success_count++;
    }
  });

  const dailyTrend = Array.from(dailyTrendMap.entries())
    .map(([date, data]) => ({
      date,
      ...data,
      success_rate: data.count > 0 ? (data.success_count / data.count) * 100 : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7); // Last 7 days

  return {
    total_transactions: totalTransactions,
    total_amount: totalAmount,
    success_rate: successRate,
    total_schools: uniqueSchools,
    provider_breakdown: providerBreakdown,
    top_schools: topSchools,
    daily_trend: dailyTrend
  };
}
