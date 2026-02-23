import { useQuery } from '@tanstack/react-query';
import { validatePremiumFeature } from '../helpers/premiumFeatures';

type PremiumCheckResult = {
  hasAccess: boolean;
  error?: string;
};

export function usePremiumCheck(schoolId?: string, feature?: string) {
  return useQuery<PremiumCheckResult>({
    queryKey: ['premiumCheck', schoolId, feature],
    queryFn: async () => {
      if (!schoolId || !feature) {
        return { hasAccess: false, error: 'Missing school or feature' };
      }

      const validation = await validatePremiumFeature(schoolId, feature);
      return { hasAccess: validation.valid, error: validation.error };
    },
    enabled: Boolean(schoolId && feature),
  });
}
