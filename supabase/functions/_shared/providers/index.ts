// ============================================================================
// Mobile Money Provider Factory
// ============================================================================
// Factory pattern for creating Mobile Money provider instances
// Supports: Orange Money, Moov Money, MTN Mobile Money, Wave
// ============================================================================

import { OrangeMoneyProvider } from './orangeMoney.ts';
import { MoovMoneyProvider } from './moovMoney.ts';
import { MTNMoneyProvider } from './mtnMoney.ts';
import { WaveProvider } from './wave.ts';
import type {
  MobileMoneyProvider,
  ProviderConfig,
  PaymentParams,
  PaymentResponse,
  StatusResponse
} from './types.ts';

/**
 * Get a Mobile Money provider instance by code
 * @param providerCode - The provider code (orange_money, moov_money, mtn_money, wave)
 * @returns A provider instance implementing MobileMoneyProvider interface
 * @throws Error if provider code is unknown
 */
export function getProvider(providerCode: string): MobileMoneyProvider {
  switch (providerCode) {
    case 'orange_money':
      return new OrangeMoneyProvider();
    case 'moov_money':
      return new MoovMoneyProvider();
    case 'mtn_money':
      return new MTNMoneyProvider();
    case 'wave':
      return new WaveProvider();
    default:
      throw new Error(`Unknown provider: ${providerCode}`);
  }
}

/**
 * Validate phone number format for a specific provider
 * @param providerCode - The provider code
 * @param phoneNumber - The phone number to validate
 * @returns true if valid, false otherwise
 */
export function validatePhoneNumber(providerCode: string, phoneNumber: string): boolean {
  const provider = getProvider(providerCode);
  return provider.validatePhoneNumber(phoneNumber);
}

/**
 * Get payment instructions for a provider
 * @param providerCode - The provider code
 * @returns Payment instructions object
 */
export function getPaymentInstructions(providerCode: string): {
  message: string;
  ussd_code?: string;
  steps?: string[];
} {
  const provider = getProvider(providerCode);
  return provider.getPaymentInstructions();
}

// Export all provider classes and types
export { OrangeMoneyProvider } from './orangeMoney.ts';
export { MoovMoneyProvider } from './moovMoney.ts';
export { MTNMoneyProvider } from './mtnMoney.ts';
export { WaveProvider } from './wave.ts';
export type {
  MobileMoneyProvider,
  ProviderConfig,
  PaymentParams,
  PaymentResponse,
  StatusResponse,
  WebhookVerificationResult
} from './types.ts';

