// ============================================
// Module Premium - API Export Avancé
// Helper: Export Module Access Check
// ============================================

import { supabase } from './supabaseClient.ts';

// Custom errors for export module
export class PremiumFeatureRequiredError extends Error {
  constructor(message = 'Cette fonctionnalité nécessite une licence Premium ou Enterprise') {
    super(message);
    this.name = 'PremiumFeatureRequiredError';
  }
}

export class ModuleNotEnabledError extends Error {
  constructor(message = 'Le module API Export doit être activé dans les paramètres de votre école') {
    super(message);
    this.name = 'ModuleNotEnabledError';
  }
}

export class ExportAccessDeniedError extends Error {
  constructor(message = 'Vous n\'avez pas les permissions nécessaires pour effectuer cet export') {
    super(message);
    this.name = 'ExportAccessDeniedError';
  }
}

/**
 * Check if school has access to export API module
 * @param schoolId - School ID to check
 * @returns Object with hasAccess flag and optional error message
 */
export async function checkExportApiAccess(
  supabaseClient: any,
  schoolId: string
): Promise<{ hasAccess: boolean; error?: string; licenseType?: string }> {
  try {
    // Get school data with license and modules
    const { data: school, error: schoolError } = await supabaseClient
      .from('schools')
      .select(`
        id,
        license_type,
        license_expires_at,
        enabled_modules
      `)
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return {
        hasAccess: false,
        error: 'École introuvable'
      };
    }

    // Check if license is active and not expired
    if (!['premium', 'enterprise'].includes(school.license_type)) {
      return {
        hasAccess: false,
        error: 'Cette fonctionnalité nécessite une licence Premium ou Enterprise',
        licenseType: school.license_type
      };
    }

    // Check if license is not expired
    if (school.license_expires_at && new Date(school.license_expires_at) < new Date()) {
      return {
        hasAccess: false,
        error: 'Votre licence a expiré. Veuillez la renouveler pour continuer à utiliser cette fonctionnalité',
        licenseType: school.license_type
      };
    }

    // Check if api_export module is enabled
    const enabledModules = school.enabled_modules || [];
    if (!enabledModules.includes('api_export')) {
      return {
        hasAccess: false,
        error: 'Le module API Export doit être activé dans les paramètres de votre école',
        licenseType: school.license_type
      };
    }

    // All checks passed
    return {
      hasAccess: true,
      licenseType: school.license_type
    };

  } catch (error) {
    console.error('Error checking export API access:', error);
    return {
      hasAccess: false,
      error: 'Erreur lors de la vérification des permissions'
    };
  }
}

/**
 * Require export API access or throw error
 * Use this function when the feature is mandatory
 * @param schoolId - School ID to check
 * @throws PremiumFeatureRequiredError if license is not premium/enterprise
 * @throws ModuleNotEnabledError if api_export module is not enabled
 */
export async function requireExportApiAccess(
  supabaseClient: any,
  schoolId: string
): Promise<void> {
  const check = await checkExportApiAccess(supabaseClient, schoolId);

  if (!check.hasAccess) {
    // Determine which error to throw based on the error message
    if (check.error?.includes('licence')) {
      throw new PremiumFeatureRequiredError(check.error);
    } else if (check.error?.includes('module')) {
      throw new ModuleNotEnabledError(check.error);
    } else {
      throw new ExportAccessDeniedError(check.error);
    }
  }
}

/**
 * Check if user can access export system for a school
 * @param userId - User ID to check
 * @param schoolId - School ID to check
 * @returns true if user has access, false otherwise
 */
export async function canUserAccessExports(
  supabaseClient: any,
  userId: string,
  schoolId: string
): Promise<boolean> {
  try {
    // Check if user is school admin
    const { data: isAdmin } = await supabaseClient
      .rpc('can_access_export_system', {
        user_id: userId,
        school_id: schoolId
      });

    return isAdmin || false;
  } catch (error) {
    console.error('Error checking user export access:', error);
    return false;
  }
}

/**
 * Get user's school ID for exports
 * @param userId - User ID
 * @returns School ID or null
 */
export async function getUserExportSchoolId(
  supabaseClient: any,
  userId: string
): Promise<string | null> {
  try {
    // Check school_admins first
    const { data: adminData } = await supabaseClient
      .from('school_admins')
      .select('school_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (adminData) {
      return adminData.school_id;
    }

    // Check school_accountants
    const { data: accountantData } = await supabaseClient
      .from('school_accountants')
      .select('school_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (accountantData) {
      return accountantData.school_id;
    }

    return null;
  } catch (error) {
    console.error('Error getting user school ID:', error);
    return null;
  }
}

/**
 * Validate export quota limits
 * @param schoolId - School ID
 * @returns Object with canExport flag and optional error message
 */
export async function checkExportQuota(
  supabaseClient: any,
  schoolId: string
): Promise<{ canExport: boolean; error?: string; exportsThisMonth?: number; limit?: number }> {
  try {
    // Get license type to determine limits
    const { data: school } = await supabaseClient
      .from('schools')
      .select('license_type')
      .eq('id', schoolId)
      .single();

    if (!school) {
      return {
        canExport: false,
        error: 'École introuvable'
      };
    }

    // Define limits based on license type
    const limits = {
      premium: 500, // 500 exports per month
      enterprise: -1 // Unlimited
    };

    const limit = limits[school.license_type as keyof typeof limits] || 0;

    // If unlimited (enterprise), skip check
    if (limit === -1) {
      return {
        canExport: true,
        exportsThisMonth: 0,
        limit: -1
      };
    }

    // Count exports this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabaseClient
      .from('export_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .gte('created_at', startOfMonth.toISOString());

    const exportsThisMonth = count || 0;

    if (exportsThisMonth >= limit) {
      return {
        canExport: false,
        error: `Limite d'exports mensuelle atteinte (${exportsThisMonth}/${limit}). Veuillez passer à la licence Enterprise pour des exports illimités.`,
        exportsThisMonth,
        limit
      };
    }

    return {
      canExport: true,
      exportsThisMonth,
      limit
    };

  } catch (error) {
    console.error('Error checking export quota:', error);
    return {
      canExport: false,
      error: 'Erreur lors de la vérification du quota'
    };
  }
}

/**
 * Check concurrent export limit
 * @param schoolId - School ID
 * @param maxConcurrent - Maximum concurrent exports (default: 10)
 * @returns true if under limit, false otherwise
 */
export async function checkConcurrentExportLimit(
  supabaseClient: any,
  schoolId: string,
  maxConcurrent: number = 10
): Promise<boolean> {
  try {
    // Count currently processing exports
    const { count } = await supabaseClient
      .from('export_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .in('status', ['pending', 'processing']);

    const concurrentExports = count || 0;

    return concurrentExports < maxConcurrent;
  } catch (error) {
    console.error('Error checking concurrent export limit:', error);
    return true; // Allow on error to not block exports
  }
}

/**
 * Log export request to audit logs
 * @param schoolId - School ID
 * @param userId - User ID
 * @param action - Action type
 * @param metadata - Additional metadata
 */
export async function logExportAction(
  supabaseClient: any,
  schoolId: string,
  userId: string,
  action: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await supabaseClient
      .from('audit_logs')
      .insert({
        action,
        entity_type: 'export',
        school_id: schoolId,
        user_id: userId,
        metadata: metadata as any
      });
  } catch (error) {
    console.error('Error logging export action:', error);
    // Don't throw - logging failures shouldn't block exports
  }
}

// Export all functions
export default {
  checkExportApiAccess,
  requireExportApiAccess,
  canUserAccessExports,
  getUserExportSchoolId,
  checkExportQuota,
  checkConcurrentExportLimit,
  logExportAction,
  PremiumFeatureRequiredError,
  ModuleNotEnabledError,
  ExportAccessDeniedError
};
