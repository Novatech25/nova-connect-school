// ============================================================================
// Import Module Verification Helper
// ============================================================================
// Helper functions to verify that a school has access to import features
// ============================================================================

/**
 * Error thrown when import features are required but not available
 */
export class ImportFeatureRequiredError extends Error {
  constructor(feature: string) {
    super(`The ${feature} feature requires a Premium or Enterprise license`);
    this.name = 'ImportFeatureRequiredError';
  }
}

/**
 * Error thrown when import module is not enabled
 */
export class ImportModuleNotEnabledError extends Error {
  constructor(module: string) {
    super(`The ${module} module is not enabled for this school`);
    this.name = 'ImportModuleNotEnabledError';
  }
}

/**
 * Verify that a school has access to Import API features
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @throws ImportFeatureRequiredError if license is not premium/enterprise
 * @throws ImportModuleNotEnabledError if import module is not enabled
 */
export async function requireImportApiAccess(
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
    throw new ImportFeatureRequiredError('Import API');
  }

  if (
!['premium', 'enterprise'].includes(license.license_type)
) {
    throw new ImportFeatureRequiredError('Import API');
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

  if (!enabledModules.includes('api_import')) {
    throw new ImportModuleNotEnabledError('api_import');
  }
}

/**
 * Check if a school has access to Import API features (non-throwing version)
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @returns Object with hasAccess boolean and optional error message
 */
export async function checkImportApiAccess(
  supabase: any,
  schoolId: string
): Promise<{ hasAccess: boolean; error?: string }> {
  try {
    await requireImportApiAccess(supabase, schoolId);
    return { hasAccess: true };
  } catch (error) {
    return {
      hasAccess: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if a specific import feature is enabled
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @param feature - Feature to check (e.g., 'import_students', 'import_grades')
 * @returns true if feature is enabled, false otherwise
 */
export async function checkImportFeature(
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
      .select('enabled_modules, settings')
      .eq('id', schoolId)
      .single();

    const enabledModules = school?.enabled_modules || [];
    return enabledModules.includes('api_import');
  } catch (error) {
    console.error('Error checking import feature:', error);
    return false;
  }
}

/**
 * Check import quota for a school
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @returns Object with canImport boolean, error message, imports this month, and limit
 */
export async function checkImportQuota(
  supabase: any,
  schoolId: string
): Promise<{ canImport: boolean; error?: string; importsThisMonth?: number; limit?: number }> {
  try {
    // Get license type to determine quota
    const { data: license } = await supabase
      .from('licenses')
      .select('license_type')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!license) {
      return { canImport: false, error: 'No active license found' };
    }

    const limit = license.license_type === 'enterprise' ? null : 100; // 100/month for premium, unlimited for enterprise

    // Count imports this month
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('import_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .gte('created_at', firstDayOfMonth.toISOString());

    const importsThisMonth = count || 0;

    if (limit && importsThisMonth >= limit) {
      return {
        canImport: false,
        error: `Monthly import quota reached (${importsThisMonth}/${limit}). Please upgrade to Enterprise for unlimited imports.`,
        importsThisMonth,
        limit
      };
    }

    return {
      canImport: true,
      importsThisMonth,
      limit
    };
  } catch (error) {
    console.error('Error checking import quota:', error);
    return {
      canImport: false,
      error: 'Failed to check import quota'
    };
  }
}

/**
 * Get all enabled modules for a school
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @returns Array of enabled module names
 */
export async function getEnabledImportModules(
  supabase: any,
  schoolId: string
): Promise<string[]> {
  try {
    const { data: school } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .single();

    const importSettings = school?.settings?.importApi || {};
    const enabledTypes = Object.keys(importSettings).filter(
      key => importSettings[key]?.enabled === true
    );

    return enabledTypes;
  } catch (error) {
    console.error('Error getting enabled import modules:', error);
    return [];
  }
}
