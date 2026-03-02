// ============================================================================
// MTN Mobile Money Provider Implementation
// ============================================================================
// Integration with MTN Mobile Money API for mobile payments
// Supports multiple African countries
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

export class MTNMoneyProvider implements MobileMoneyProvider {
  private readonly API_VERSION = 'v1';
  private readonly HMAC_ALGORITHM = 'sha256';

  /**
   * Validate phone number format for MTN Mobile Money
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // MTN prefixes vary by country
    const mtnPrefixes = {
      '+237': [/^6[7-8][0-9]{7}$/], // Cameroon
      '+225': [/^05[0-9]{7}$/, /^07[0-9]{7}$/], // CI
      '+233': [/^(024|054|055|020)[0-9]{7}$/], // Ghana
      '+256': [/^(077|078|076|070)[0-9]{7}$/], // Uganda
      '+250': [/^07[8-9][0-9]{7}$/], // Rwanda
      '+260': [/^09[6-7][0-9]{7}$/], // Zambia
      '+265': [/^(099|088)[0-9]{7}$/], // Malawi
      '+234': [/^(070|080|081|090)[0-9]{8}$/], // Nigeria
    };

    for (const [countryCode, patterns] of Object.entries(mtnPrefixes)) {
      if (cleaned.startsWith(countryCode)) {
        const number = cleaned.substring(countryCode.length);
        return patterns.some(pattern => pattern.test(number));
      }
    }

    return false;
  }

  /**
   * Get payment instructions for MTN Mobile Money
   */
  getPaymentInstructions() {
    return {
      message: 'Vous allez recevoir un prompt MTN Mobile Money sur votre tÃ©lÃ©phone. Entrez votre code PIN pour autoriser le paiement.',
      ussd_code: '*165#',
      steps: [
        'Attendez le prompt MTN Mobile Money',
        'Entrez votre code PIN pour autoriser',
        'Le paiement sera confirmÃ© automatiquement'
      ]
    };
  }

  /**
   * Format phone number for MTN Mobile Money API
   */
  formatPhoneNumber(phoneNumber: string): string {
    let formatted = phoneNumber.replace(/[^\d+]/g, '');

    if (!formatted.startsWith('+')) {
      // Default to Cameroon if no country code
      formatted = '+237' + formatted;
    }

    return formatted;
  }

  /**
   * Initiate payment with MTN Mobile Money API
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
            message: 'Invalid phone number format for MTN Mobile Money'
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

      const apiEndpoint = `${config.api_endpoint}/${this.API_VERSION}/collections`;
      const timestamp = Date.now();
      const externalId = `MTN-${config.school_id}-${params.reference}-${timestamp}`;

      const requestBody = {
        amount: params.amount,
        currency: params.currency || 'XOF',
        external_id: externalId,
        payer: {
          partyId: formattedPhone,
          partyIdType: 'MSISDN'
        },
        payer_message: `Payment for ${params.reference}`,
        payee_note: 'School fees payment',
        callback_url: `${config.settings.webhook_url || ''}/mobile-money-webhook-mtn`
      };

      // Generate authorization token
      const authToken = Buffer.from(
        `${config.api_key_encrypted}:${config.api_secret_encrypted || ''}`
      ).toString('base64');

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Reference-Id': externalId,
          'X-Target-Environment': config.is_test_mode ? 'sandbox' : 'production',
          'Ocp-Apim-Subscription-Key': config.api_key_encrypted
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();

      if (response.ok && responseData.status === 'pending') {
        return {
          success: true,
          external_transaction_id: responseData.financialTransactionId,
          status: 'pending',
          message: 'Payment initiated successfully',
          payment_instructions: this.getPaymentInstructions()
        };
      } else {
        return {
          success: false,
          error_code: responseData.errorCode || 'INITIATION_FAILED',
          error_details: responseData
        };
      }
    } catch (error) {
      console.error('MTN Mobile Money API error:', error);
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
   * Check transaction status with MTN Mobile Money API
   */
  async checkStatus(
    config: ProviderConfig,
    externalTransactionId: string
  ): Promise<StatusResponse> {
    try {
      const apiEndpoint = `${config.api_endpoint}/${this.API_VERSION}/collections/${externalTransactionId}`;

      const authToken = Buffer.from(
        `${config.api_key_encrypted}:${config.api_secret_encrypted || ''}`
      ).toString('base64');

      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Ocp-Apim-Subscription-Key': config.api_key_encrypted,
          'X-Target-Environment': config.is_test_mode ? 'sandbox' : 'production'
        }
      });

      const responseData = await response.json();

      return {
        success: response.ok,
        status: this.mapStatus(responseData.status),
        amount: responseData.amount,
        completed_at: responseData.creationDate,
        error_code: responseData.errorCode,
        error_message: responseData.error_message,
        provider_response: responseData
      };
    } catch (error) {
      console.error('MTN Mobile Money status check error:', error);
      return {
        success: false,
        status: 'unknown',
        error_code: 'STATUS_CHECK_FAILED',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify MTN Mobile Money webhook signature
   */
  verifyWebhook(
    config: ProviderConfig,
    signature: string,
    payload: any
  ): WebhookVerificationResult {
    try {
      // MTN uses custom signature verification
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
        external_transaction_id: payload.financialTransactionId,
        status: this.mapStatus(payload.status),
        amount: payload.amount
      };
    } catch (error) {
      console.error('MTN Mobile Money webhook verification error:', error);
      return { valid: false };
    }
  }

  /**
   * Map MTN status to our internal status
   */
  private mapStatus(mtnStatus: string): string {
    const statusMap: Record<string, string> = {
      'PENDING': 'pending',
      'SUCCESSFUL': 'success',
      'FAILED': 'failed',
      'FAILED_TIMEOUT': 'expired',
      'FAILED_CANCELLED': 'cancelled'
    };

    return statusMap[mtnStatus] || 'pending';
  }
}

