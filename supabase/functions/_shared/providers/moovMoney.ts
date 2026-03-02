// ============================================================================
// Moov Money Provider Implementation
// ============================================================================
// Integration with Moov Money API for mobile payments
// Supports: BJ (BÃ©nin), TG (Togo), CI (CÃ´te d'Ivoire), BF (Burkina Faso)
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

export class MoovMoneyProvider implements MobileMoneyProvider {
  private readonly API_VERSION = 'v1';
  private readonly HMAC_ALGORITHM = 'sha512';

  /**
   * Validate phone number format for Moov Money
   * Format: Country code + number (e.g., +22991234567)
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

    const moovPrefixes = {
      '+229': [/^9[0-9]{7}$/, /^6[0-9]{7}$/], // BÃ©nin
      '+228': [/^9[0-9]{7}$/], // Togo
      '+225': [/^0[14][0-9]{7}$/], // CI
      '+226': [/^7[0-9]{8}$/] // BF
    };

    for (const [countryCode, patterns] of Object.entries(moovPrefixes)) {
      if (cleaned.startsWith(countryCode)) {
        const number = cleaned.substring(countryCode.length);
        return patterns.some(pattern => pattern.test(number));
      }
    }

    return false;
  }

  /**
   * Get payment instructions for Moov Money
   */
  getPaymentInstructions() {
    return {
      message: 'Vous allez recevoir un SMS de Moov Money. Veuillez valider le paiement en rÃ©pondant "OUI".',
      ussd_code: '*155#',
      steps: [
        'Composez *155# sur votre tÃ©lÃ©phone Moov',
        'SÃ©lectionnez "Paiements"',
        'Choisissez "Paiement marchand"',
        'Entrez le code PIN pour valider'
      ]
    };
  }

  /**
   * Format phone number for Moov Money API
   */
  formatPhoneNumber(phoneNumber: string): string {
    let formatted = phoneNumber.replace(/[^\d+]/g, '');

    if (!formatted.startsWith('+')) {
      // Assume BÃ©nin if no country code
      formatted = '+229' + formatted;
    }

    return formatted;
  }

  /**
   * Initiate payment with Moov Money API
   */
  async initiatePayment(
    config: ProviderConfig,
    params: PaymentParams
  ): Promise<PaymentResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(params.phone_number);

      if (!this.validatePhoneNumber(formattedPhone)) {
        return {
          success: false,
          error_code: 'INVALID_PHONE_NUMBER',
          error_details: {
            message: 'Invalid phone number format for Moov Money'
          }
        };
      }

      if (params.amount < config.min_amount || params.amount > config.max_amount) {
        return {
          success: false,
          error_code: 'INVALID_AMOUNT',
          error_details: {
            message: `Amount must be between ${config.min_amount} and ${config.max_amount} ${params.currency || 'XOF'}`
          }
        };
      }

      const apiEndpoint = `${config.api_endpoint}/${this.API_VERSION}/transactions`;
      const timestamp = Date.now();
      const externalId = `MV-${config.school_id}-${params.reference}-${timestamp}`;

      const requestBody = {
        merchant_id: config.merchant_id,
        transaction_id: externalId,
        amount: params.amount,
        currency: params.currency || 'XOF',
        customer_msisdn: formattedPhone,
        reference: params.reference,
        callback_url: `${config.settings.webhook_url || ''}/mobile-money-webhook-moov`,
        metadata: params.metadata || {}
      };

      // Moov Money uses HMAC-SHA512
      const signature = this.generateSignature(
        config.api_secret_encrypted || '',
        JSON.stringify(requestBody),
        timestamp
      );

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key_encrypted}`,
          'X-Moov-Signature': signature,
          'X-Moov-Timestamp': timestamp.toString()
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();

      if (response.ok && responseData.status === 'PENDING') {
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
      console.error('Moov Money API error:', error);
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
   * Check transaction status with Moov Money API
   */
  async checkStatus(
    config: ProviderConfig,
    externalTransactionId: string
  ): Promise<StatusResponse> {
    try {
      const apiEndpoint = `${config.api_endpoint}/${this.API_VERSION}/transactions/${externalTransactionId}`;

      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.api_key_encrypted}`
        }
      });

      const responseData = await response.json();

      return {
        success: response.ok,
        status: this.mapStatus(responseData.status),
        amount: responseData.amount,
        completed_at: responseData.completed_at,
        error_code: responseData.error_code,
        error_message: responseData.error_message,
        provider_response: responseData
      };
    } catch (error) {
      console.error('Moov Money status check error:', error);
      return {
        success: false,
        status: 'unknown',
        error_code: 'STATUS_CHECK_FAILED',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify Moov Money webhook signature
   */
  verifyWebhook(
    config: ProviderConfig,
    signature: string,
    payload: any
  ): WebhookVerificationResult {
    try {
      // Moov Money uses HMAC-SHA512 signature
      const expectedSignature = crypto
        .createHmac(this.HMAC_ALGORITHM, config.api_secret_encrypted || '')
        .update(JSON.stringify(payload))
        .digest('hex');

      const isValid = signature === expectedSignature;

      if (!isValid) {
        return { valid: false };
      }

      return {
        valid: true,
        external_transaction_id: payload.transaction_id,
        status: this.mapStatus(payload.status),
        amount: payload.amount
      };
    } catch (error) {
      console.error('Moov Money webhook verification error:', error);
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
   * Map Moov Money status to our internal status
   */
  private mapStatus(moovStatus: string): string {
    const statusMap: Record<string, string> = {
      'PENDING': 'pending',
      'SUCCESS': 'success',
      'FAILED': 'failed',
      'CANCELLED': 'cancelled',
      'EXPIRED': 'expired',
      'REFUNDED': 'refunded'
    };

    return statusMap[moovStatus] || 'pending';
  }
}

