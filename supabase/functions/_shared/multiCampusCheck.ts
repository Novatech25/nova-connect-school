// ============================================================================
// Multi-Campus Premium Feature Verification Helper
// ============================================================================
// Helper functions to verify that a school has access to multi-campus features
// ============================================================================

import {
  PremiumFeatureRequiredError,
  ModuleNotEnabledError,
  checkPremiumFeature
} from './premiumCheck.ts';

/**
 * Verify that a school has access to Multi-Campus features
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @throws PremiumFeatureRequiredError if license is not premium/enterprise
 * @throws ModuleNotEnabledError if multi_campus module is not enabled
 */
export async function requireMultiCampusAccess(
  supabase: any,
  schoolId: string
): Promise<void> {
  const hasAccess = await checkPremiumFeature(supabase, schoolId, 'multi_campus');

  if (!hasAccess) {
    // Check if it's a license issue
    const { data: license } = await supabase
      .from('licenses')
      .select('license_type, status, expires_at')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!license || !['premium', 'enterprise'].includes(license.license_type)) {
      throw new PremiumFeatureRequiredError('Multi-Campus');
    }

    // It's a module not enabled issue
    throw new ModuleNotEnabledError('multi_campus');
  }
}

/**
 * Check if a school has access to Multi-Campus features (non-throwing version)
 * @param supabase - Supabase client
 * @param schoolId - School ID to check
 * @returns Object with hasAccess boolean and optional error message
 */
export async function checkMultiCampusAccess(
  supabase: any,
  schoolId: string
): Promise<{ hasAccess: boolean; error?: string; licenseType?: string }> {
  try {
    await requireMultiCampusAccess(supabase, schoolId);

    // Get license type for additional context
    const { data: license } = await supabase
      .from('licenses')
      .select('license_type')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    return {
      hasAccess: true,
      licenseType: license?.license_type
    };
  } catch (error) {
    return {
      hasAccess: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all campuses accessible to a user within a school
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param schoolId - School ID
 * @returns Array of campus objects
 */
export async function getUserAccessibleCampuses(
  supabase: any,
  userId: string,
  schoolId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .rpc('get_accessible_campuses', { p_user_id: userId });

  if (error) {
    console.error('Error getting accessible campuses:', error);
    return [];
  }

  return data || [];
}

/**
 * Check if a user has access to a specific campus
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param campusId - Campus ID
 * @returns true if user has access, false otherwise
 */
export async function hasUserCampusAccess(
  supabase: any,
  userId: string,
  campusId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('check_user_campus_access', {
        p_user_id: userId,
        p_campus_id: campusId
      });

    if (error) {
      console.error('Error checking campus access:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking campus access:', error);
    return false;
  }
}

/**
 * Get campus information for a class
 * @param supabase - Supabase client
 * @param classId - Class ID
 * @returns Campus object or null
 */
export async function getClassCampus(
  supabase: any,
  classId: string
): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('campus_id, campuses(*)')
      .eq('id', classId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.campuses;
  } catch (error) {
    console.error('Error getting class campus:', error);
    return null;
  }
}

/**
 * Filter items by user's campus access
 * @param items - Array of items with optional campus_id
 * @param allowedCampusIds - Array of campus IDs the user can access
 * @returns Filtered array
 */
export function filterByCampusAccess<T extends { campus_id?: string | null }>(
  items: T[],
  allowedCampusIds: string[]
): T[] {
  return items.filter(item =>
    !item.campus_id || allowedCampusIds.includes(item.campus_id)
  );
}

/**
 * Check if multi-campus is enabled for a school and return context
 * @param supabase - Supabase client
 * @param schoolId - School ID
 * @returns Object with isEnabled boolean and additional context
 */
export async function getMultiCampusContext(
  supabase: any,
  schoolId: string
): Promise<{
  isEnabled: boolean;
  campuses: any[];
  licenseType?: string;
  error?: string;
}> {
  try {
    // Check if module is enabled
    const { data: school } = await supabase
      .from('schools')
      .select('enabled_modules')
      .eq('id', schoolId)
      .single();

    const enabledModules = school?.enabled_modules || [];
    const isEnabled = enabledModules.includes('multi_campus');

    if (!isEnabled) {
      return {
        isEnabled: false,
        campuses: [],
        error: 'Multi-campus module is not enabled'
      };
    }

    // Get all campuses for the school
    const { data: campuses, error: campusesError } = await supabase
      .from('campuses')
      .select('*')
      .eq('school_id', schoolId)
      .order('is_main', { ascending: false })
      .order('name');

    if (campusesError) {
      throw campusesError;
    }

    // Get license type
    const { data: license } = await supabase
      .from('licenses')
      .select('license_type')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    return {
      isEnabled: true,
      campuses: campuses || [],
      licenseType: license?.license_type
    };
  } catch (error) {
    console.error('Error getting multi-campus context:', error);
    return {
      isEnabled: false,
      campuses: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
