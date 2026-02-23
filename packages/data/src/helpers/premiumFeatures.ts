import { getSupabaseClient } from '../client'

// ============================================================================
// PREMIUM FEATURE ACCESS HELPERS
// ============================================================================

/**
 * Check if a school has access to a premium feature
 * @param schoolId - The school ID to check
 * @param feature - The feature to check (e.g., 'qr_advanced')
 * @returns Promise<boolean> - True if the school has access
 */
export async function checkPremiumFeature(
  schoolId: string,
  feature: string
): Promise<boolean> {
  try {
    // Check license
    const { data: license } = await getSupabaseClient()
      .from('licenses')
      .select('license_type, status, expires_at')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!license) {
      return false
    }

    if (!['premium', 'enterprise'].includes(license.license_type)) {
      return false
    }

    // Check enabled modules
    const { data: school } = await getSupabaseClient()
      .from('schools')
      .select('enabled_modules, settings')
      .eq('id', schoolId)
      .single()

    if (!school) {
      return false
    }

    const enabledModules = school.enabled_modules || []
    if (!enabledModules.includes(feature)) {
      return false
    }

    // Check feature-specific settings
    if (feature === 'qr_advanced') {
      const premiumSettings = school.settings?.qrAttendancePremium
      return premiumSettings?.enabled === true
    }

    if (feature === 'chat_moderation') {
      const premiumSettings = school.settings?.chatModeration
      return premiumSettings?.enabled === true
    }

    return true
  } catch (error) {
    console.error('Error checking premium feature:', error)
    return false
  }
}

/**
 * Get all premium features enabled for a school
 * @param schoolId - The school ID
 * @returns Promise<string[]> - List of enabled premium features
 */
export async function getPremiumFeatures(schoolId: string): Promise<string[]> {
  try {
    const hasAccess = await checkPremiumFeature(schoolId, 'qr_advanced')
    if (!hasAccess) {
      return []
    }

    const { data: school } = await getSupabaseClient()
      .from('schools')
      .select('enabled_modules')
      .eq('id', schoolId)
      .single()

    return school?.enabled_modules || []
  } catch (error) {
    console.error('Error getting premium features:', error)
    return []
  }
}

/**
 * Require a premium feature - throws error if not available
 * @param schoolId - The school ID
 * @param feature - The feature to check
 * @throws Error if feature is not available
 */
export async function requirePremiumFeature(
  schoolId: string,
  feature: string
): Promise<void> {
  const hasAccess = await checkPremiumFeature(schoolId, feature)
  if (!hasAccess) {
    throw new Error(
      `Premium feature '${feature}' is not available for this school. Please upgrade your license or contact support.`
    )
  }
}

/**
 * Get premium license information for a school
 * @param schoolId - The school ID
 * @returns License information or null
 */
export async function getPremiumLicenseInfo(schoolId: string) {
  try {
    const { data: license } = await getSupabaseClient()
      .from('licenses')
      .select('*')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return license
  } catch (error) {
    console.error('Error getting license info:', error)
    return null
  }
}

/**
 * Get premium QR settings for a school
 * @param schoolId - The school ID
 * @returns Premium QR settings or null
 */
export async function getPremiumQrSettings(schoolId: string) {
  try {
    const { data: school } = await getSupabaseClient()
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .single()

    return school?.settings?.qrAttendancePremium || null
  } catch (error) {
    console.error('Error getting premium QR settings:', error)
    return null
  }
}

/**
 * Check if a specific premium QR feature is enabled
 * @param schoolId - The school ID
 * @param subFeature - The sub-feature to check (e.g., 'classQrEnabled', 'cardQrEnabled')
 * @returns Promise<boolean> - True if enabled
 */
export async function isPremiumQrFeatureEnabled(
  schoolId: string,
  subFeature: string
): Promise<boolean> {
  try {
    const hasAccess = await checkPremiumFeature(schoolId, 'qr_advanced')
    if (!hasAccess) {
      return false
    }

    const settings = await getPremiumQrSettings(schoolId)
    return settings?.[subFeature] === true
  } catch (error) {
    console.error('Error checking premium QR feature:', error)
    return false
  }
}

// ============================================================================
// PREMIUM FEATURE VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a school can use a premium feature
 * Returns a detailed error message if validation fails
 */
export async function validatePremiumFeature(
  schoolId: string,
  feature: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check license existence
    const { data: license } = await getSupabaseClient()
      .from('licenses')
      .select('license_type, status, expires_at')
      .eq('school_id', schoolId)
      .maybeSingle()

    if (!license) {
      return {
        valid: false,
        error: 'No license found. Please contact support to obtain a license.',
      }
    }

    // Check license status
    if (license.status !== 'active') {
      return {
        valid: false,
        error: `License is ${license.status}. Please activate your license or contact support.`,
      }
    }

    // Check license expiration
    if (new Date(license.expires_at) < new Date()) {
      return {
        valid: false,
        error: `License expired on ${new Date(license.expires_at).toLocaleDateString()}. Please renew your license.`,
      }
    }

    // Check license type
    if (!['premium', 'enterprise'].includes(license.license_type)) {
      return {
        valid: false,
        error: `This feature requires a Premium or Enterprise license. Current license: ${license.license_type}.`,
      }
    }

    // Check if module is enabled
    const { data: school } = await getSupabaseClient()
      .from('schools')
      .select('enabled_modules, settings')
      .eq('id', schoolId)
      .single()

    if (!school) {
      return {
        valid: false,
        error: 'School not found.',
      }
    }

    const enabledModules = school.enabled_modules || []
    if (!enabledModules.includes(feature)) {
      return {
        valid: false,
        error: `Feature '${feature}' is not enabled. Please enable it in school settings.`,
      }
    }

    // Check feature-specific settings
    if (feature === 'qr_advanced') {
      const premiumSettings = school.settings?.qrAttendancePremium
      if (!premiumSettings?.enabled) {
        return {
          valid: false,
          error: 'Premium QR features are not enabled. Please enable them in school settings.',
        }
      }
    }

    if (feature === 'chat_moderation') {
      const premiumSettings = school.settings?.chatModeration
      if (!premiumSettings?.enabled) {
        return {
          valid: false,
          error: 'Chat moderation features are not enabled. Please enable them in school settings.',
        }
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('Error validating premium feature:', error)
    return {
      valid: false,
      error: error.message || 'Failed to validate feature access',
    }
  }
}

/**
 * Get license status information
 */
export async function getLicenseStatus(schoolId: string) {
  try {
    const license = await getPremiumLicenseInfo(schoolId)

    if (!license) {
      return {
        hasLicense: false,
        isActive: false,
        licenseType: null,
        expiresAt: null,
        daysRemaining: 0,
      }
    }

    const now = new Date()
    const expiresAt = new Date(license.expires_at)
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      hasLicense: true,
      isActive: license.status === 'active' && expiresAt > now,
      licenseType: license.license_type,
      expiresAt: license.expires_at,
      daysRemaining,
    }
  } catch (error) {
    console.error('Error getting license status:', error)
    return {
      hasLicense: false,
      isActive: false,
      licenseType: null,
      expiresAt: null,
      daysRemaining: 0,
    }
  }
}

// ============================================================================
// PREMIUM FEATURE UTILITIES
// ============================================================================

/**
 * Format a premium feature error message for user display
 */
export function formatPremiumFeatureError(validation: { valid: boolean; error?: string }): string {
  if (!validation.error) {
    return 'This feature is not available.'
  }

  return validation.error
}

/**
 * Check if any premium features are available for a school
 */
export async function hasAnyPremiumFeatures(schoolId: string): Promise<boolean> {
  const features = await getPremiumFeatures(schoolId)
  return features.length > 0
}

/**
 * Get a list of all available premium features (regardless of enablement)
 */
export function getAvailablePremiumFeatures(): string[] {
  return [
    'qr_advanced',
    'e_learning',
    'chat_moderation',
    'api_import',
    // Add more premium features here as they are implemented
    // 'analytics_advanced',
    // 'reports_custom',
    // etc.
  ]
}

/**
 * Get human-readable name for a premium feature
 */
export function getPremiumFeatureName(feature: string): string {
  const featureNames: Record<string, string> = {
    qr_advanced: 'Advanced QR Attendance',
    e_learning: 'E-Learning Module',
    chat_moderation: 'Chat Moderation',
    api_import: 'Import Excel/CSV',
  }

  return featureNames[feature] || feature
}

/**
 * Get description for a premium feature
 */
export function getPremiumFeatureDescription(feature: string): string {
  const descriptions: Record<string, string> = {
    qr_advanced:
      'Advanced QR attendance with rapid rotation, device fingerprinting, and anomaly detection',
    e_learning:
      'Online assignments, file submissions, grading system, and course resources',
    chat_moderation:
      'Moderated chat system with automatic content filtering, message approval workflow, and comprehensive moderation logs',
    api_import:
      'Bulk import students, grades, and schedules from Excel/CSV files with validation, preview, and rollback capabilities',
  }

  return descriptions[feature] || 'Premium feature'
}
