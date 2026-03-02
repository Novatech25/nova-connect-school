// ============================================================================
// Premium Feature Verification Helper
// ============================================================================
// Helper functions to verify that a school has access to premium features
// ============================================================================

/**
 * Error thrown when premium features are required but not available
 */
export class PremiumFeatureRequiredError extends Error {
  constructor(feature: string) {
    super(`The ${feature} feature requires a Premium or Enterprise license`);
    this.name = 'PremiumFeatureRequiredError';
  }
}

/**
 * Error thrown when a module is not enabled
 */
export class ModuleNotEnabledError extends Error {
  constructor(module: string) {
    super(`The ${module} module is not enabled for this school`);
    this.name = 'ModuleNotEnabledError';
  }
}

/**
 * Verify that a school has access to Mobile Money features
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @throws PremiumFeatureRequiredError if license is not premium/enterprise
 * @throws ModuleNotEnabledError if mobile_money module is not enabled
 */
export async function requireMobileMoneyAccess(
  supabase: any,
  schoolId: string
): Promise<void> {
  // Check license
  const { data: license, error: licenseError } = await supabase
    .from('licenses')
    .select('license_type, status, expires_at')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (licenseError) {
    console.error('Error checking license:', licenseError);
    throw new Error('Failed to verify license');
  }

  if (!license) {
    throw new PremiumFeatureRequiredError('Mobile Money');
  }

  if (
!['premium', 'enterprise'].includes(license.license_type)
) {
    throw new PremiumFeatureRequiredError('Mobile Money');
  }

  // Check if module is enabled
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('enabled_modules')
    .eq('id', schoolId)
    .single();

  if (schoolError) {
    console.error('Error checking school:', schoolError);
    throw new Error('Failed to verify school configuration');
  }

  const enabledModules = school?.enabled_modules || [];

  if (!enabledModules.includes('mobile_money')) {
    throw new ModuleNotEnabledError('mobile_money');
  }
}

/**
 * Check if a school has access to Mobile Money features (non-throwing version)
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @returns Object with hasAccess boolean and optional error message
 */
export async function checkMobileMoneyAccess(
  supabase: any,
  schoolId: string
): Promise<{ hasAccess: boolean; error?: string }> {
  try {
    await requireMobileMoneyAccess(supabase, schoolId);
    return { hasAccess: true };
  } catch (error) {
    return {
      hasAccess: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if a specific premium feature is enabled
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @param feature - Feature to check (e.g., 'mobile_money', 'qr_attendance')
 * @returns true if feature is enabled, false otherwise
 */
export async function checkPremiumFeature(
  supabase: any,
  schoolId: string,
  feature: string
): Promise<boolean> {
  try {
    const { data: license } = await supabase
      .from('licenses')
      .select('license_type, status, expires_at')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!license || !['premium', 'enterprise'].includes(license.license_type)) {
      return false;
    }

    const { data: school } = await supabase
      .from('schools')
      .select('enabled_modules')
      .eq('id', schoolId)
      .single();

    const enabledModules = school?.enabled_modules || [];

    return enabledModules.includes(feature);
  } catch (error) {
    console.error('Error checking premium feature:', error);
    return false;
  }
}

/**
 * Get all enabled modules for a school
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @returns Array of enabled module names
 */
export async function getEnabledModules(
  supabase: any,
  schoolId: string
): Promise<string[]> {
  try {
    const { data: school } = await supabase
      .from('schools')
      .select('enabled_modules')
      .eq('id', schoolId)
      .single();

    return school?.enabled_modules || [];
  } catch (error) {
    console.error('Error getting enabled modules:', error);
    return [];
  }
}

/**
 * Check if license is active and not expired
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @returns Object with isActive boolean and license type
 */
export async function checkLicenseStatus(
  supabase: any,
  schoolId: string
): Promise<{ isActive: boolean; licenseType?: string; expiresAt?: string }> {
  try {
    const { data: license } = await supabase
      .from('licenses')
      .select('license_type, status, expires_at')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!license) {
      return { isActive: false };
    }

    return {
      isActive: true,
      licenseType: license.license_type,
      expiresAt: license.expires_at
    };
  } catch (error) {
    console.error('Error checking license status:', error);
    return { isActive: false };
  }
}
