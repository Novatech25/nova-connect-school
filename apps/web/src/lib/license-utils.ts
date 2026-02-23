import { licenseTypeSchema, licenseStatusSchema, type LicenseType, type LicenseStatus } from "@novaconnect/core";

/**
 * Generates a unique license key in format NOVA-XXXX-XXXX-XXXX-XXXX
 * This is a client-side preview. Actual generation should happen server-side.
 */
export function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    const segment = Math.floor(Math.random() * 10000)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');
    segments.push(segment);
  }
  return `NOVA-${segments.join('-')}`;
}

/**
 * Formats a license key with consistent spacing
 */
export function formatLicenseKey(key: string): string {
  const cleaned = key.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length !== 20) return key;

  const segments = [
    cleaned.slice(0, 4),
    cleaned.slice(4, 8),
    cleaned.slice(8, 12),
    cleaned.slice(12, 16),
    cleaned.slice(16, 20),
  ];
  return `NOVA-${segments.join('-')}`;
}

/**
 * Validates license key format
 */
export function validateLicenseKey(key: string): boolean {
  const pattern = /^NOVA-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;
  return pattern.test(key);
}

/**
 * Returns badge color for license status
 */
export function getLicenseStatusColor(status: LicenseStatus): string {
  const colors = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    expired: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    revoked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    suspended: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  };
  return colors[status];
}

/**
 * Returns human-readable label for license type
 */
export function getLicenseTypeLabel(type: LicenseType): string {
  const labels = {
    trial: "Trial",
    basic: "Basic",
    premium: "Premium",
    enterprise: "Enterprise",
  };
  return labels[type];
}

/**
 * Returns badge color for license type
 */
export function getLicenseTypeColor(type: LicenseType): string {
  const colors = {
    trial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    basic: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    premium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    enterprise: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  };
  return colors[type];
}

/**
 * Calculates days until expiration
 */
export function getDaysUntilExpiration(expiresAt: Date | string): number {
  const expiration = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const diff = expiration.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Checks if license expires soon (within 30 days)
 */
export function isExpiringSoon(expiresAt: Date | string): boolean {
  const days = getDaysUntilExpiration(expiresAt);
  return days >= 0 && days <= 30;
}

/**
 * Checks if license is expired
 */
export function isExpired(expiresAt: Date | string): boolean {
  return getDaysUntilExpiration(expiresAt) < 0;
}

/**
 * Generates hardware fingerprint (simplified version)
 * In production, this would gather more system information
 */
export function generateHardwareFingerprint(): string {
  // This is a placeholder. In a real implementation, you would gather
  // system-specific information like MAC address, CPU ID, etc.
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`.toUpperCase();
}

/**
 * Checks if license activation limit is reached
 */
export function isActivationLimitReached(
  activationCount: number,
  maxActivations: number
): boolean {
  return activationCount >= maxActivations;
}

/**
 * Calculates license utilization percentage
 */
export function getLicenseUtilization(
  activationCount: number,
  maxActivations: number
): number {
  return Math.round((activationCount / maxActivations) * 100);
}
