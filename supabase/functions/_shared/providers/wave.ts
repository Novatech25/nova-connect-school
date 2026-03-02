// ============================================================================
// Wave Provider Implementation
// ============================================================================
// Integration with Wave API for mobile payments
// Supports: SN (SÃ©nÃ©gal), CI (CÃ´te d'Ivoire), BF (Burkina Faso), ML (Mali)
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

export class WaveProvider implements MobileMoneyProvider {
  private readonly API_VERSION = 'v1';
  private readonly HMAC_ALGORITHM = 'sha256';

  /**
   * Validate phone number format for Wave
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Wave primarily operates in Senegal, expanding to other countries
    const wavePrefixes = {
      '+221': [/^7[6-7][0-9]{7}$/], // SÃ©nÃ©gal
      '+225': [/^0[5-7][0-9]{7}$/], // CI (expanding)
      '+226': [/^7[0-9]{8}$/], // BF (expanding)
      '+223': [/^7[0-9]{8}$/] // ML (expanding)
    };

    for (const [countryCode, patterns] of Object.entries(wavePrefixes)) {
      if (cleaned.startsWith(countryCode)) {
        const number = cleaned.substring(countryCode.length);
        return patterns.some(pattern => pattern.test(number));
      }
    }

    return false;
  }

  /**
   * Get payment instructions for Wave
   */
  getPaymentInstructions() {
    return {
      message: 'Vous allez recevoir une notification Wave. Veuillez cliquer sur le lien et valider le paiement avec votre code PIN.',
      steps: [
        'Ouvrez l\'application Wave ou cliquez sur le lien reÃ§u',
        'Confirmez le paiement',
        'Entrez votre code PIN Wave pour valider'
      ]
    };
  }

  /**
   * Format phone number for Wave API
   */
  formatPhoneNumber(phoneNumber: string): string {
    let formatted = phoneNumber.replace(/[^\d+]/g, '');

    if (!formatted.startsWith('+')) {
      // Default to Senegal if no country code
      formatted = '+221' + formatted;
    }

    return formatted;
  }

  /**
   * Initiate payment with Wave API
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
            message: 'Invalid phone number format for Wave'
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

      const apiEndpoint = `${config.api_endpoint}/${this.API_VERSION}/charges`;
      const externalId = `WV-${config.school_id}-${params.reference}-${Date.now()}`;

      const requestBody = {
        amount: params.amount,
        currency: params.currency || 'XOF',
        error_url: `${config.settings.error_url || ''}/wave/error`,
        success_url: `${config.settings.success_url || ''}/wave/success`,
        client_reference: params.reference,
        external_transaction_id: externalId,
        phone_number: formattedPhone,
        metadata: params.metadata || {}
      };

      // Wave uses Bearer token authentication
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key_encrypted}`
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();

      if (response.ok && (responseData.status === 'pending' || responseData.status === 'succeeded')) {
        return {
          success: true,
          external_transaction_id: responseData.id,
          status: responseData.status === 'succeeded' ? 'success' : 'pending',
          message: 'Payment initiated successfully',
          payment_instructions: {
            ...this.getPaymentInstructions(),
            payment_link: responseData.payment_link
          }
        };
      } else {
        return {
          success: false,
          error_code: responseData.error_code || 'INITIATION_FAILED',
          error_details: responseData
        };
      }
    } catch (error) {
      console.error('Wave API error:', error);
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
   * Check transaction status with Wave API
   */
  async checkStatus(
    config: ProviderConfig,
    externalTransactionId: string
  ): Promise<StatusResponse> {
    try {
      const apiEndpoint = `${config.api_endpoint}/${this.API_VERSION}/charges/${externalTransactionId}`;

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
        completed_at: responseData.completed_at || responseData.last_updated,
        error_code: responseData.error_code,
        error_message: responseData.error_message,
        provider_response: responseData
      };
    } catch (error) {
      console.error('Wave status check error:', error);
      return {
        success: false,
        status: 'unknown',
        error_code: 'STATUS_CHECK_FAILED',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify Wave webhook signature
   */
  verifyWebhook(
    config: ProviderConfig,
    signature: string,
    payload: any
  ): WebhookVerificationResult {
    try {
      // Wave uses HMAC-SHA256 for webhook signature
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
        external_transaction_id: payload.data?.id,
        status: this.mapStatus(payload.data?.status),
        amount: payload.data?.amount
      };
    } catch (error) {
      console.error('Wave webhook verification error:', error);
      return { valid: false };
    }
  }

  /**
   * Map Wave status to our internal status
   */
  private mapStatus(waveStatus: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'succeeded': 'success',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'expired': 'expired',
      'refunded': 'refunded'
    };

    return statusMap[waveStatus] || 'pending';
  }
}

