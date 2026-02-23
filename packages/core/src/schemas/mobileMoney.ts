import { z } from 'zod';

// ============================================================================
// Mobile Money - Zod Schemas
// ============================================================================
// Validation schemas for Mobile Money payment system
// ============================================================================

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------

/**
 * Supported Mobile Money providers
 */
export const mobileMoneyProviderCodeSchema = z.enum([
  'orange_money',
  'moov_money',
  'mtn_money',
  'wave',
  'other'
]);

/**
 * Mobile Money transaction status
 */
export const mobileMoneyStatusSchema = z.enum([
  'initiated',
  'pending',
  'success',
  'failed',
  'cancelled',
  'expired',
  'refunded'
]);

/**
 * Reconciliation status
 */
export const reconciliationStatusSchema = z.enum([
  'pending',
  'auto',
  'manual',
  'failed'
]);

// ----------------------------------------------------------------------------
// Provider Schemas
// ----------------------------------------------------------------------------

/**
 * Mobile Money provider configuration
 */
export const mobileMoneyProviderSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  provider_code: mobileMoneyProviderCodeSchema,
  provider_name: z.string().min(1).max(255),
  api_endpoint: z.string().url(),
  api_key_encrypted: z.string().optional(),
  api_secret_encrypted: z.string().optional(),
  merchant_id: z.string().optional(),
  is_active: z.boolean(),
  is_test_mode: z.boolean(),
  supported_countries: z.array(z.string()), // ISO country codes
  transaction_fee_percent: z.number().min(0).max(100),
  transaction_fee_fixed: z.number().min(0),
  min_amount: z.number().positive(),
  max_amount: z.number().positive(),
  settings: z.record(z.any()),
  metadata: z.record(z.any()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

/**
 * Input for creating a provider
 */
export const createMobileMoneyProviderSchema = z.object({
  school_id: z.string().uuid(),
  provider_code: mobileMoneyProviderCodeSchema,
  provider_name: z.string().min(1).max(255),
  api_endpoint: z.string().url(),
  api_key: z.string().min(1), // Will be encrypted
  api_secret: z.string().min(1).optional(), // Will be encrypted
  merchant_id: z.string().optional(),
  is_active: z.boolean().default(true),
  is_test_mode: z.boolean().default(true),
  supported_countries: z.array(z.string()).min(1),
  transaction_fee_percent: z.number().min(0).max(100).default(0),
  transaction_fee_fixed: z.number().min(0).default(0),
  min_amount: z.number().positive().default(100),
  max_amount: z.number().positive().default(500000),
  settings: z.record(z.any()).default({}),
  metadata: z.record(z.any()).default({})
});

/**
 * Input for updating a provider
 */
export const updateMobileMoneyProviderSchema = z.object({
  provider_name: z.string().min(1).max(255).optional(),
  api_endpoint: z.string().url().optional(),
  api_key: z.string().min(1).optional(),
  api_secret: z.string().min(1).optional(),
  merchant_id: z.string().optional(),
  is_active: z.boolean().optional(),
  is_test_mode: z.boolean().optional(),
  supported_countries: z.array(z.string()).optional(),
  transaction_fee_percent: z.number().min(0).max(100).optional(),
  transaction_fee_fixed: z.number().min(0).optional(),
  min_amount: z.number().positive().optional(),
  max_amount: z.number().positive().optional(),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

/**
 * Input for toggling provider active status
 */
export const toggleMobileMoneyProviderSchema = z.object({
  provider_id: z.string().uuid(),
  is_active: z.boolean()
});

// ----------------------------------------------------------------------------
// Transaction Schemas
// ----------------------------------------------------------------------------

/**
 * Mobile Money transaction
 */
export const mobileMoneyTransactionSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  student_id: z.string().uuid(),
  fee_schedule_id: z.string().uuid().nullable(),
  payment_id: z.string().uuid().nullable(),
  transaction_reference: z.string().min(1),
  external_transaction_id: z.string().nullable(),
  phone_number: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('XOF'),
  status: mobileMoneyStatusSchema,
  initiated_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  expires_at: z.string().datetime(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  retry_count: z.number().int().nonnegative(),
  max_retries: z.number().int().positive(),
  webhook_received_at: z.string().datetime().nullable(),
  reconciled_at: z.string().datetime().nullable(),
  reconciled_by: z.string().uuid().nullable(),
  reconciliation_status: reconciliationStatusSchema,
  metadata: z.record(z.any()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

/**
 * Input for initiating a Mobile Money payment
 */
export const initiateMobileMoneyPaymentSchema = z.object({
  student_id: z.string().uuid(),
  fee_schedule_id: z.string().uuid().optional(),
  amount: z.number().positive(),
  phone_number: z.string().min(1),
  provider_code: mobileMoneyProviderCodeSchema,
  metadata: z.record(z.any()).optional().default({})
});

/**
 * Response from payment initiation
 */
export const initiateMobileMoneyPaymentResponseSchema = z.object({
  success: z.boolean(),
  transaction_id: z.string().uuid(),
  transaction_reference: z.string(),
  external_transaction_id: z.string().nullable(),
  status: mobileMoneyStatusSchema,
  expires_at: z.string().datetime(),
  payment_instructions: z.object({
    message: z.string(),
    ussd_code: z.string().optional(),
    steps: z.array(z.string()).optional()
  })
});

/**
 * Input for manual reconciliation
 */
export const reconcileTransactionSchema = z.object({
  transaction_id: z.string().uuid(),
  payment_id: z.string().uuid(),
  notes: z.string().optional()
});

/**
 * Input for retrying a failed transaction
 */
export const retryTransactionSchema = z.object({
  transaction_id: z.string().uuid()
});

/**
 * Input for checking transaction status
 */
export const checkTransactionStatusSchema = z.object({
  transaction_id: z.string().uuid()
});

/**
 * Response from status check
 */
export const checkTransactionStatusResponseSchema = z.object({
  transaction_id: z.string().uuid(),
  status: mobileMoneyStatusSchema,
  external_status: z.string().optional(),
  provider_response: z.record(z.any()).optional(),
  can_retry: z.boolean()
});

// ----------------------------------------------------------------------------
// Filter Schemas
// ----------------------------------------------------------------------------

/**
 * Filters for querying transactions
 */
export const mobileMoneyFiltersSchema = z.object({
  school_id: z.string().uuid(),
  student_id: z.string().uuid().optional(),
  provider_id: z.string().uuid().optional(),
  provider_code: mobileMoneyProviderCodeSchema.optional(),
  status: mobileMoneyStatusSchema.optional(),
  reconciliation_status: reconciliationStatusSchema.optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  amount_from: z.number().positive().optional(),
  amount_to: z.number().positive().optional(),
  phone_number: z.string().optional(),
  search: z.string().optional() // Search by reference or student name
});

/**
 * Sort options for transactions
 */
export const mobileMoneySortSchema = z.object({
  field: z.enum([
    'initiated_at',
    'amount',
    'status',
    'provider_code',
    'student_name'
  ]),
  order: z.enum(['asc', 'desc'])
});

/**
 * Pagination parameters
 */
export const mobileMoneyPaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
});

// ----------------------------------------------------------------------------
// Provider Test Schemas
// ----------------------------------------------------------------------------

/**
 * Input for testing provider connection
 */
export const testMobileMoneyProviderSchema = z.object({
  provider_id: z.string().uuid().optional(),
  provider_code: mobileMoneyProviderCodeSchema.optional(),
  config: z.object({
    api_endpoint: z.string().url(),
    api_key: z.string(),
    api_secret: z.string().optional(),
    merchant_id: z.string().optional(),
    is_test_mode: z.boolean()
  }).optional()
});

/**
 * Response from provider test
 */
export const testMobileMoneyProviderResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  details: z.record(z.any()).optional(),
  error_code: z.string().optional()
});

// ----------------------------------------------------------------------------
// Export Schemas
// ----------------------------------------------------------------------------

/**
 * Input for exporting transactions
 */
export const exportMobileMoneyTransactionsSchema = z.object({
  school_id: z.string().uuid(),
  filters: mobileMoneyFiltersSchema.partial().optional(),
  format: z.enum(['csv', 'excel']),
  include_headers: z.boolean().default(true)
});

// ----------------------------------------------------------------------------
// KPI Schemas
// ----------------------------------------------------------------------------

/**
 * KPIs for Mobile Money transactions
 */
export const mobileMoneyKpisSchema = z.object({
  total_transactions: z.number().int().nonnegative(),
  total_amount: z.number().nonnegative(),
  success_rate: z.number().min(0).max(100),
  pending_transactions: z.number().int().nonnegative(),
  failed_transactions: z.number().int().nonnegative(),
  average_amount: z.number().nonnegative(),
  average_processing_time_seconds: z.number().nonnegative(),
  auto_reconciliation_rate: z.number().min(0).max(100),
  provider_breakdown: z.array(z.object({
    provider_code: mobileMoneyProviderCodeSchema,
    provider_name: z.string(),
    total_transactions: z.number().int().nonnegative(),
    total_amount: z.number().nonnegative(),
    success_rate: z.number().min(0).max(100)
  })),
  daily_volume: z.array(z.object({
    date: z.string().datetime(),
    count: z.number().int().nonnegative(),
    amount: z.number().nonnegative()
  }))
});

// ============================================================================
// TypeScript Type Exports
// ============================================================================

export type MobileMoneyProviderCode = z.infer<typeof mobileMoneyProviderCodeSchema>;
export type MobileMoneyStatus = z.infer<typeof mobileMoneyStatusSchema>;
export type ReconciliationStatus = z.infer<typeof reconciliationStatusSchema>;

export type MobileMoneyProvider = z.infer<typeof mobileMoneyProviderSchema>;
export type CreateMobileMoneyProviderInput = z.infer<typeof createMobileMoneyProviderSchema>;
export type UpdateMobileMoneyProviderInput = z.infer<typeof updateMobileMoneyProviderSchema>;
export type ToggleMobileMoneyProviderInput = z.infer<typeof toggleMobileMoneyProviderSchema>;

export type MobileMoneyTransaction = z.infer<typeof mobileMoneyTransactionSchema>;
export type InitiateMobileMoneyPaymentInput = z.infer<typeof initiateMobileMoneyPaymentSchema>;
export type InitiateMobileMoneyPaymentResponse = z.infer<typeof initiateMobileMoneyPaymentResponseSchema>;
export type ReconcileTransactionInput = z.infer<typeof reconcileTransactionSchema>;
export type RetryTransactionInput = z.infer<typeof retryTransactionSchema>;
export type CheckTransactionStatusInput = z.infer<typeof checkTransactionStatusSchema>;
export type CheckTransactionStatusResponse = z.infer<typeof checkTransactionStatusResponseSchema>;

export type MobileMoneyFilters = z.infer<typeof mobileMoneyFiltersSchema>;
export type MobileMoneySort = z.infer<typeof mobileMoneySortSchema>;
export type MobileMoneyPagination = z.infer<typeof mobileMoneyPaginationSchema>;

export type TestMobileMoneyProviderInput = z.infer<typeof testMobileMoneyProviderSchema>;
export type TestMobileMoneyProviderResponse = z.infer<typeof testMobileMoneyProviderResponseSchema>;

export type ExportMobileMoneyTransactionsInput = z.infer<typeof exportMobileMoneyTransactionsSchema>;

export type MobileMoneyKpis = z.infer<typeof mobileMoneyKpisSchema>;

/**
 * Global KPIs for super admin (across all schools)
 */
export const globalMobileMoneyKpisSchema = z.object({
  total_transactions: z.number().int().nonnegative(),
  total_amount: z.number().nonnegative(),
  success_rate: z.number().min(0).max(100),
  total_schools: z.number().int().nonnegative(),
  provider_breakdown: z.array(z.object({
    provider_code: mobileMoneyProviderCodeSchema,
    provider_name: z.string(),
    total_transactions: z.number().int().nonnegative(),
    total_amount: z.number().nonnegative(),
    success_rate: z.number().min(0).max(100)
  })),
  top_schools: z.array(z.object({
    school_id: z.string().uuid(),
    school_name: z.string(),
    total_transactions: z.number().int().nonnegative(),
    total_amount: z.number().nonnegative()
  })),
  daily_trend: z.array(z.object({
    date: z.string().datetime(),
    count: z.number().int().nonnegative(),
    amount: z.number().nonnegative(),
    success_count: z.number().int().nonnegative(),
    success_rate: z.number().min(0).max(100)
  }))
});

export type GlobalMobileMoneyKpis = z.infer<typeof globalMobileMoneyKpisSchema>;
