import { checkPremiumFeature, PremiumFeatureRequiredError, ModuleNotEnabledError } from './premiumCheck.ts';

export async function requireELearningAccess(supabase: any, schoolId: string): Promise<void> {
  const hasAccess = await checkPremiumFeature(supabase, schoolId, 'e_learning');
  if (!hasAccess) {
    // Check license type
    const { data: license } = await supabase
      .from('licenses')
      .select('license_type, status, expires_at')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!license || !['premium', 'enterprise'].includes(license.license_type)) {
      throw new PremiumFeatureRequiredError('E-Learning');
    }
    throw new ModuleNotEnabledError('e_learning');
  }
}

export async function checkELearningAccess(supabase: any, schoolId: string): Promise<{ hasAccess: boolean; error?: string }> {
  try {
    await requireELearningAccess(supabase, schoolId);
    return { hasAccess: true };
  } catch (error) {
    return { hasAccess: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
