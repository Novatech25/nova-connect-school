// ============================================================================
// Webhook Verification Helper
// ============================================================================
// Centralized webhook signature verification for Mobile Money providers
// ============================================================================

import { getProvider } from './providers/index.ts';
import type { ProviderConfig } from './providers/types.ts';

/**
 * Verify webhook signature and extract transaction details
 * @param provider - Provider configuration
 * @param signature - Webhook signature from headers
 * @param payload - Webhook payload
 * @returns Verification result with transaction details
 */
export async function verifyWebhook(
  provider: ProviderConfig,
  signature: string,
  payload: any
) {
  try {
    const providerInstance = getProvider(provider.provider_code);
    return providerInstance.verifyWebhook(provider, signature, payload);
  } catch (error) {
    console.error('Webhook verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Extract transaction reference from webhook payload
 * Handles various formats from different providers
 * @param payload - Webhook payload
 * @param providerCode - Provider code
 * @returns Transaction reference if found, null otherwise
 */
export function extractTransactionReference(
  payload: any,
  providerCode: string
): string | null {
  try {
    // Different providers use different field names
    const referenceFields = [
      'transaction_reference',
      'reference',
      'external_reference',
      'client_reference',
      'merchant_reference',
      'order_id'
    ];

    for (const field of referenceFields) {
      if (payload[field]) {
        return payload[field];
      }
    }

    // Some providers nest the reference in a data object
    if (payload.data) {
      for (const field of referenceFields) {
        if (payload.data[field]) {
          return payload.data[field];
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting transaction reference:', error);
    return null;
  }
}

/**
 * Extract external transaction ID from webhook payload
 * @param payload - Webhook payload
 * @param providerCode - Provider code
 * @returns External transaction ID if found, null otherwise
 */
export function extractExternalTransactionId(
  payload: any,
  providerCode: string
): string | null {
  try {
    const idFields = [
      'transaction_id',
      'external_transaction_id',
      'id',
      'payment_id',
      'transactionId'
    ];

    for (const field of idFields) {
      if (payload[field]) {
        return payload[field];
      }
    }

    if (payload.data) {
      for (const field of idFields) {
        if (payload.data[field]) {
          return payload.data[field];
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting external transaction ID:', error);
    return null;
  }
}

/**
 * Map provider status to internal status
 * @param status - Provider status
 * @param providerCode - Provider code
 * @returns Internal status
 */
export function mapProviderStatus(
  status: string,
  providerCode: string
): string {
  const statusMap: Record<string, Record<string, string>> = {
    orange_money: {
      'pending': 'pending',
      'success': 'success',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'expired': 'expired'
    },
    moov_money: {
      'PENDING': 'pending',
      'SUCCESS': 'success',
      'FAILED': 'failed',
      'CANCELLED': 'cancelled',
      'EXPIRED': 'expired'
    },
    mtn_money: {
      'PENDING': 'pending',
      'SUCCESSFUL': 'success',
      'FAILED': 'failed',
      'FAILED_TIMEOUT': 'expired',
      'FAILED_CANCELLED': 'cancelled'
    },
    wave: {
      'pending': 'pending',
      'succeeded': 'success',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'expired': 'expired'
    }
  };

  const providerMap = statusMap[providerCode] || statusMap.orange_money;
  return providerMap[status] || 'pending';
}

/**
 * Get signature header name for a provider
 * @param providerCode - Provider code
 * @returns Header name(s) to check for signature
 */
export function getSignatureHeaderName(providerCode: string): string[] {
  const headerMap: Record<string, string[]> = {
    orange_money: ['x-orange-signature', 'X-Orange-Signature', 'signature'],
    moov_money: ['x-moov-signature', 'X-Moov-Signature', 'signature'],
    mtn_money: ['x-mtn-signature', 'X-MTN-Signature', 'signature'],
    wave: ['x-wave-signature', 'X-Wave-Signature', 'signature']
  };

  return headerMap[providerCode] || ['signature'];
}

/**
 * Validate webhook payload structure
 * @param payload - Webhook payload
 * @returns true if valid, false otherwise
 */
export function validateWebhookPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  // Check for essential fields
  const hasStatus = payload.status !== undefined;
  const hasId = payload.transaction_id || payload.id || payload.payment_id;

  return hasStatus && hasId;
}
