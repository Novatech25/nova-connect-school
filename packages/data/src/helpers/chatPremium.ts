import { getSupabaseClient } from '../client';
import { checkPremiumFeature } from './premiumFeatures';

export async function requireChatAccess(schoolId: string): Promise<void> {
  const hasAccess = await checkPremiumFeature(schoolId, 'chat_moderation');
  if (!hasAccess) {
    throw new Error(
      'Chat feature requires a Premium or Enterprise license with chat_moderation module enabled.'
    );
  }
}

export async function checkChatAccess(schoolId: string): Promise<boolean> {
  return await checkPremiumFeature(schoolId, 'chat_moderation');
}

export async function getChatSettings(schoolId: string) {
  try {
    const { data: school } = await getSupabaseClient()
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .single();

    return school?.settings?.chatModeration || null;
  } catch (error) {
    console.error('Error getting chat settings:', error);
    return null;
  }
}

export async function isChatFeatureEnabled(
  schoolId: string,
  subFeature: string
): Promise<boolean> {
  try {
    const hasAccess = await checkChatAccess(schoolId);
    if (!hasAccess) return false;

    const settings = await getChatSettings(schoolId);
    return settings?.[subFeature] === true;
  } catch (error) {
    console.error('Error checking chat feature:', error);
    return false;
  }
}
