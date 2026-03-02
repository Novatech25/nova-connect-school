// ============================================================================
// Orange Money Provider Implementation
// ============================================================================
// Integration with Orange Money API for mobile payments
// Supports: CI (CÃ´te d'Ivoire), SN (SÃ©nÃ©gal), ML (Mali), BF (Burkina Faso), NE (Niger)
// ============================================================================

import crypto from 'https://deno.land/std@0.177.0/node/crypto.ts';
import type {
  MobileMoneyProvider,
  ProviderConfig,
  PaymentParams,
  PaymentResponse,
  StatusResponse,
  WebhookVerificationResult
} from './types.ts';

export class OrangeMoneyProvider implements MobileMoneyProvider {
  private readonly API_VERSION = 'v1';
  private readonly HMAC_ALGORITHM = 'sha256';

  /**
   * Validate phone number format for Orange Money
   * Format: Country code + number (e.g., +2250712345678)
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // Remove spaces, dashes, etc.
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Check for Orange Money prefixes (varies by country)
    const orangePrefixes = {
      '+225': [/^07[0-9]{7}$/, /^05[0-9]{7}$/, /^01[0-9]{7}$/], // CI
      '+221': [/^77[0-9]{7}$/, /^78[0-9]{7}$/], // SN
      '+223': [/^7[0-9]{8}$/], // ML
      '+226': [/^7[0-9]{8}$/], // BF
      '+227': [/^9[0-9]{8}$/]  // NE
    };

    for (const [countryCode, patterns] of Object.entries(orangePrefixes)) {
      if (cleaned.startsWith(countryCode)) {
        const number = cleaned.substring(countryCode.length);
        return patterns.some(pattern => pattern.test(number));
      }
    }

    return false;
  }

  /**
   * Get payment instructions for Orange Money
   */
  getPaymentInstructions() {
    return {
      message: 'Vous allez recevoir une notification sur votre tÃ©lÃ©phone Orange Money. Veuillez accepter le paiement en entrant votre code PIN.',
      ussd_code: '*144#',
      steps: [
        'Composez *144# sur votre tÃ©lÃ©phone Orange',
        'SÃ©lectionnez "Paiement"',
        'Entrez le montant et le code PIN pour valider'
      ]
    };
  }

  /**
   * Format phone number for Orange Money API
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters except +
    let formatted = phoneNumber.replace(/[^\d+]/g, '');

    // Ensure country code is present
    if (!formatted.startsWith('+')) {
      // Assume CI if no country code
      formatted = '+225' + formatted;
    }

    return formatted;
  }

  /**
   * Initiate payment with Orange Money API
   */
  async initiatePayment(
    config: ProviderConfig,
    params: PaymentParams
  ): Promise<PaymentResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(params.phone_number);

      // Validate phone number
      if (!this.validatePhoneNumber(formattedPhone)) {
        return {
          success: false,
          error_code: 'INVALID_PHONE_NUMBER',
          error_details: {
            message: 'Invalid phone number format for Orange Money'
          }
        };
      }

      // Validate amount
      if (params.amount < config.min_amount || params.amount > config.max_amount) {
        return {
          success: false,
          error_code: 'INVALID_AMOUNT',
          error_details: {
            message: `Amount must be between ${config.min_amount} and ${config.max_amount} ${params.currency || 'XOF'}`,
            min_amount: config.min_amount,
            max_amount: config.max_amount
          }
        };
      }

      // Prepare API request
      const apiEndpoint = `${config.api_endpoint}/${this.API_VERSION}/payments`;
      const timestamp = Date.now();
      const externalId = `OM-${config.school_id}-${params.reference}-${timestamp}`;

      const requestBody = {
        merchant_id: config.merchant_id,
        external_id: externalId,
        amount: params.amount,
        currency: params.currency || 'XOF',
        phone_number: formattedPhone,
        reference: params.reference,
        callback_url: `${config.settings.webhook_url || ''}/mobile-money-webhook-orange`,
        metadata: params.metadata || {}
      };

      // Generate HMAC signature
      const signature = this.generateSignature(
        config.api_secret_encrypted || '',
        JSON.stringify(requestBody),
        timestamp
      );

      // Make API request
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key_encrypted}`,
          'X-Orange-Signature': signature,
          'X-Orange-Timestamp': timestamp.toString()
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();

      if (response.ok && responseData.status === 'pending') {
        return {
          success: true,
          external_transaction_id: responseData.transaction_id,
          status: 'pending',
          message: 'Payment initiated successfully',
          payment_instructions: this.getPaymentInstructions()
        };
      } else {
        return {
          success: false,
          error_code: responseData.error_code || 'INITIATION_FAILED',
          error_details: responseData
        };
      }
    } catch (error) {
      console.error('Orange Money API error:', error);
      return {
        success: false,
        error_code: 'API_ERROR',
        error_details: {
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check transaction status with Orange Money API
   */
  async checkStatus(
    config: ProviderConfig,
    externalTransactionId: string
  ): Promise<StatusResponse> {
    try {
      const apiEndpoint = `${config.api_endpoint}/${this.API_VERSION}/payments/${externalTransactionId}`;

      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.api_key_encrypted}`
        }
      });

      const responseData = await response.json();

      return {
        success: response.ok,
        status: responseData.status,
        amount: responseData.amount,
        completed_at: responseData.completed_at,
        error_code: responseData.error_code,
        error_message: responseData.error_message,
        provider_response: responseData
      };
    } catch (error) {
      console.error('Orange Money status check error:', error);
      return {
        success: false,
        status: 'unknown',
        error_code: 'STATUS_CHECK_FAILED',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify Orange Money webhook signature
   */
  verifyWebhook(
    config: ProviderConfig,
    signature: string,
    payload: any
  ): WebhookVerificationResult {
    try {
      // Orange Money uses HMAC-SHA256 signature
      const expectedSignature = crypto
        .createHmac(this.HMAC_ALGORITHM, config.api_secret_encrypted || '')
        .update(JSON.stringify(payload))
        .digest('hex');

      const isValid = signature === expectedSignature;

      if (!isValid) {
        return { valid: false };
      }

      // Extract transaction details from webhook payload
      return {
        valid: true,
        external_transaction_id: payload.transaction_id,
        status: this.mapStatus(payload.status),
        amount: payload.amount
      };
    } catch (error) {
      console.error('Orange Money webhook verification error:', error);
      return { valid: false };
    }
  }

  /**
   * Generate HMAC signature for API requests
   */
  private generateSignature(secret: string, body: string, timestamp: number): string {
    const data = `${body}${timestamp}`;
    return crypto
      .createHmac(this.HMAC_ALGORITHM, secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Map Orange Money status to our internal status
   */
  private mapStatus(orangeStatus: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'success': 'success',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'expired': 'expired',
      'refunded': 'refunded'
    };

    return statusMap[orangeStatus] || 'pending';
  }
}

