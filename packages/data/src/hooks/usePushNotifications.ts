'use client'

/**
 * Hook: usePushNotifications
 * 
 * Gère l'enregistrement et la mise à jour des tokens de push notification
 * pour les notifications mobiles (Expo).
 */

import { useCallback, useEffect, useState, useMemo } from 'react'
import { getSupabaseClient } from '../client'

// Wrapper hook to get supabase client (replaces non-existent useSupabaseClient from useAuth)
function useSupabaseClient() {
  return useMemo(() => getSupabaseClient(), [])
}

interface PushTokenData {
  token: string
  platform: 'mobile' | 'web' | 'desktop'
  deviceInfo?: Record<string, unknown>
}

interface UsePushNotificationsReturn {
  registerToken: (token: string, platform?: string) => Promise<void>
  unregisterToken: () => Promise<void>
  isRegistering: boolean
  error: Error | null
  lastRegisteredToken: string | null
}

/**
 * Hook pour gérer les push notifications
 * 
 * @example
 * ```tsx
 * const { registerToken, unregisterToken, isRegistering } = usePushNotifications()
 * 
 * // Enregistrer un token Expo
 * await registerToken(expoPushToken, 'mobile')
 * 
 * // Désenregistrer
 * await unregisterToken()
 * ```
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const supabase = useSupabaseClient()
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastRegisteredToken, setLastRegisteredToken] = useState<string | null>(null)

  /**
   * Enregistre un token de push notification
   */
  const registerToken = useCallback(async (
    token: string,
    platform: 'mobile' | 'web' | 'desktop' = 'mobile'
  ): Promise<void> => {
    setIsRegistering(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('Utilisateur non authentifié')
      }

      // Récupérer les informations de l'appareil
      const deviceInfo = {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
        language: typeof navigator !== 'undefined' ? navigator.language : undefined,
        timestamp: new Date().toISOString(),
      }

      const { error: upsertError } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: user.id,
          token: token,
          platform: platform,
          device_info: deviceInfo,
          is_active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform'
        })

      if (upsertError) {
        throw upsertError
      }

      setLastRegisteredToken(token)
      console.log('Push token registered successfully:', token)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to register push token')
      setError(error)
      console.error('Error registering push token:', error)
      throw error
    } finally {
      setIsRegistering(false)
    }
  }, [supabase])

  /**
   * Désenregistre le token de push notification (marque comme inactif)
   */
  const unregisterToken = useCallback(async (): Promise<void> => {
    setIsRegistering(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('Utilisateur non authentifié')
      }

      const { error: updateError } = await supabase
        .from('push_tokens')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (updateError) {
        throw updateError
      }

      setLastRegisteredToken(null)
      console.log('Push token unregistered successfully')
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to unregister push token')
      setError(error)
      console.error('Error unregistering push token:', error)
      throw error
    } finally {
      setIsRegistering(false)
    }
  }, [supabase])

  return {
    registerToken,
    unregisterToken,
    isRegistering,
    error,
    lastRegisteredToken,
  }
}

/**
 * Hook pour récupérer les tokens enregistrés de l'utilisateur courant
 */
export function useUserPushTokens() {
  const supabase = useSupabaseClient()
  const [tokens, setTokens] = useState<PushTokenData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          setTokens([])
          return
        }

        const { data, error: fetchError } = await supabase
          .from('push_tokens')
          .select('token, platform, device_info')
          .eq('user_id', user.id)
          .eq('is_active', true)

        if (fetchError) {
          throw fetchError
        }

        setTokens(data || [])
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch push tokens')
        setError(error)
        console.error('Error fetching push tokens:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTokens()
  }, [supabase])

  return { tokens, isLoading, error }
}

export default usePushNotifications
