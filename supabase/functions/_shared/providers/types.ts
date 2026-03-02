// ============================================================================
// Mobile Money Provider Types
// ============================================================================

/**
 * Provider configuration from database
 */
export interface ProviderConfig {
  id: string;
  school_id: string;
  provider_code: string;
  provider_name: string;
  api_endpoint: string;
  api_key_encrypted: string;
  api_secret_encrypted?: string;
  merchant_id?: string;
  is_test_mode: boolean;
  transaction_fee_percent: number;
  transaction_fee_fixed: number;
  min_amount: number;
  max_amount: number;
  supported_countries: string[];
  settings: Record<string, any>;
}

/**
 * Parameters for initiating a payment
 */
export interface PaymentParams {
  amount: number;
  phone_number: string;
  reference: string;
  currency?: string;
  metadata?: Record<string, any>;
}

/**
 * Response from payment initiation
 */
export interface PaymentResponse {
  success: boolean;
  external_transaction_id?: string;
  status: string;
  message?: string;
  payment_instructions?: {
    message: string;
    ussd_code?: string;
    steps?: string[];
  };
  error_code?: string;
  error_details?: Record<string, any>;
}

/**
 * Response from status check
 */
export interface StatusResponse {
  success: boolean;
  status: string;
  amount?: number;
  completed_at?: string;
  error_code?: string;
  error_message?: string;
  provider_response?: Record<string, any>;
}

/**
 * Webhook verification result
 */
export interface WebhookVerificationResult {
  valid: boolean;
  transaction_reference?: string;
  external_transaction_id?: string;
  status?: string;
  amount?: number;
  error_code?: string;
}

/**
 * Mobile Money Provider Interface
 * All providers must implement this interface
 */
export interface MobileMoneyProvider {
  /**
   * Validate phone number format for this provider
   * @param phoneNumber - Phone number to validate
   * @returns true if valid, false otherwise
   */
  validatePhoneNumber(phoneNumber: string): boolean;

  /**
   * Get payment instructions for this provider
   * @returns Instructions object with message, USSD code, and steps
   */
  getPaymentInstructions(): {
    message: string;
    ussd_code?: string;
    steps?: string[];
  };

  /**
   * Initiate a payment with the provider
   * @param config - Provider configuration
   * @param params - Payment parameters
   * @returns Payment response with transaction ID
   */
  initiatePayment(
    config: ProviderConfig,
    params: PaymentParams
  ): Promise<PaymentResponse>;

  /**
   * Check the status of a transaction
   * @param config - Provider configuration
   * @param externalTransactionId - External transaction ID from provider
   * @returns Status response
   */
  checkStatus(
    config: ProviderConfig,
    externalTransactionId: string
  ): Promise<StatusResponse>;

  /**
   * Verify webhook signature and parse payload
   * @param config - Provider configuration
   * @param signature - Webhook signature from request headers
   * @param payload - Webhook payload
   * @returns Verification result with transaction details
   */
  verifyWebhook(
    config: ProviderConfig,
    signature: string,
    payload: any
  ): WebhookVerificationResult;

  /**
   * Format phone number to provider's expected format
   * @param phoneNumber - Phone number in various formats
   * @returns Formatted phone number
   */
  formatPhoneNumber(phoneNumber: string): string;
}

