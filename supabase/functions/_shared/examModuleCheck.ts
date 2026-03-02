import { checkPremiumFeature, PremiumFeatureRequiredError, ModuleNotEnabledError } from './premiumCheck.ts';

/**
 * Verify that a school has access to Exam Mode features
 */
export async function requireExamModeAccess(
  supabase: any,
  schoolId: string
): Promise<void> {
  const hasAccess = await checkPremiumFeature(supabase, schoolId, 'exam_mode');

  if (!hasAccess) {
    // Check if it's a license issue or module not enabled
    const { data: license } = await supabase
      .from('licenses')
      .select('license_type, status, expires_at')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!license || !['premium', 'enterprise'].includes(license.license_type)) {
      throw new PremiumFeatureRequiredError('Exam Mode');
    }

    throw new ModuleNotEnabledError('exam_mode');
  }
}

/**
 * Check if Exam Mode is enabled (non-throwing)
 */
export async function checkExamModeAccess(
  supabase: any,
  schoolId: string
): Promise<{ hasAccess: boolean; error?: string }> {
  try {
    await requireExamModeAccess(supabase, schoolId);
    return { hasAccess: true };
  } catch (error) {
    return {
      hasAccess: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
