import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../client";
import { userQueries } from "../queries/users";
import * as React from "react";

export function useAuth() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  // Check auth mode first - only access localStorage on client side
  const [authMode, setAuthMode] = React.useState('online');

  // Update auth mode from localStorage on client side
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const mode = localStorage.getItem('auth_mode') || 'online';
      setAuthMode(mode);
    }
  }, []);

  // Helper functions for safe localStorage access (client-side only)
  const getLocalStorage = (key: string): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  };

  const setLocalStorage = (key: string, value: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  };

  const removeLocalStorage = (key: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  };

  // Get current auth user
  const { data: authUser, error: authError, isLoading: authLoading } = useQuery({
    queryKey: ["auth", "user", authMode],
    queryFn: async () => {
      // Helper to safely get from localStorage
      const getLocalStorage = (key: string) => {
        if (typeof window !== 'undefined') {
          return localStorage.getItem(key);
        }
        return null;
      };

      const setLocalStorage = (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value);
        }
      };

      // Check if we're in offline mode first
      if (authMode === 'offline') {
        const offlineTokens = getLocalStorage('offline_auth_tokens');
        if (offlineTokens) {
          const tokens = JSON.parse(offlineTokens);
          return tokens.user;
        }
      }

      // Try Supabase
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          // If offline tokens exist, use them
          const offlineTokens = getLocalStorage('offline_auth_tokens');
          if (offlineTokens) {
            const tokens = JSON.parse(offlineTokens);
            setAuthMode('offline');
            setLocalStorage('auth_mode', 'offline');
            return tokens.user;
          }
          throw error;
        }

        setAuthMode('online');
        setLocalStorage('auth_mode', 'online');
        return user;
      } catch (error: any) {
        // If it's a network error and we have offline tokens, use them
        if (error.message?.includes('Failed to fetch') || error.status === 0) {
          const offlineTokens = getLocalStorage('offline_auth_tokens');
          if (offlineTokens) {
            const tokens = JSON.parse(offlineTokens);
            setAuthMode('offline');
            setLocalStorage('auth_mode', 'offline');
            return tokens.user;
          }
        }
        throw error;
      }
    },
  });

  // Get current user profile with school_id - ONLY in online mode
  const { data: userProfile, error: profileError, isLoading: profileLoading } = useQuery({
    ...userQueries.getCurrent(),
    enabled: !!authUser && authMode === 'online', // Only fetch profile if auth user exists AND we're in online mode
  });

  // Combine auth user with user profile
  const user = React.useMemo(() => {
    if (authMode === 'offline' && authUser) {
      // In offline mode, use authUser directly (already has school_id from token)
      return {
        ...authUser,
        schoolId: authUser.school_id,
      };
    }

    if (userProfile && authUser) {
      // In online mode, combine authUser with userProfile
      return {
        ...authUser,
        ...userProfile,
        schoolId: userProfile.school_id
      };
    }

    return authUser;
  }, [authUser, userProfile, authMode]);

  const error = authError || profileError;
  const isLoading = authLoading || (authMode === 'online' && profileLoading);

  // Sign up
  const signUp = useMutation({
    mutationFn: async ({
      email,
      password,
      firstName,
      lastName,
      role,
      schoolCode,
    }: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: string;
      schoolCode: string;
    }) => {
      // Try Supabase first
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              role,
              school_code: schoolCode,
            },
          },
        });

        if (error) {
          // If network error, try offline auth via Gateway
          if (error.message?.includes('Failed to fetch') ||
            error.status === 0 ||
            error.message?.includes('fetch')) {

            console.warn('⚠️ Supabase unreachable, trying offline registration...');

            const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

            const response = await fetch(`${GATEWAY_URL}/api/auth/register`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email,
                password,
                firstName,
                lastName,
                role,
                schoolCode,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Offline registration failed');
            }

            const result = await response.json();

            // Store tokens and auth mode
            setLocalStorage('offline_auth_tokens', JSON.stringify(result));
            setLocalStorage('auth_mode', 'offline');

            // Return data in same format as Supabase
            return {
              user: result.user,
              session: {
                access_token: result.access_token,
                refresh_token: result.refresh_token,
                user: result.user,
              },
            };
          }

          throw error;
        }

        // Store auth mode as online
        setLocalStorage('auth_mode', 'online');
        return data;
      } catch (error: any) {
        // If it's a network error, try offline auth via Gateway
        if (error.message?.includes('Failed to fetch') ||
          error.message?.includes('NetworkError') ||
          error.status === 0 ||
          error.message?.includes('fetch')) {

          console.warn('⚠️ Supabase unreachable, trying offline registration...');

          const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

          try {
            const response = await fetch(`${GATEWAY_URL}/api/auth/register`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email,
                password,
                firstName,
                lastName,
                role,
                schoolCode,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Offline registration failed');
            }

            const result = await response.json();

            // Store tokens and auth mode
            setLocalStorage('offline_auth_tokens', JSON.stringify(result));
            setLocalStorage('auth_mode', 'offline');

            // Return data in same format as Supabase
            return {
              user: result.user,
              session: {
                access_token: result.access_token,
                refresh_token: result.refresh_token,
                user: result.user,
              },
            };
          } catch (offlineError: any) {
            console.error('❌ Offline registration also failed:', offlineError.message);
            throw new Error('Unable to connect. Please check your internet connection.');
          }
        }

        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  // Sign in
  const signIn = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      // Try Supabase first
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Store auth mode as online
        setLocalStorage('auth_mode', 'online');
        return data;
      } catch (error: any) {
        // If it's a network error, try offline auth via Gateway
        if (error.message?.includes('Failed to fetch') ||
          error.message?.includes('NetworkError') ||
          error.status === 0 ||
          error.message?.includes('fetch')) {

          console.warn('⚠️ Supabase unreachable, trying offline auth...');

          const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

          try {
            const response = await fetch(`${GATEWAY_URL}/api/auth/login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Offline login failed');
            }

            const result = await response.json();

            // Store tokens and auth mode
            setLocalStorage('offline_auth_tokens', JSON.stringify(result));
            setLocalStorage('auth_mode', 'offline');

            // Return data in same format as Supabase
            return {
              user: result.user,
              session: {
                access_token: result.access_token,
                refresh_token: result.refresh_token,
                user: result.user,
              },
            };
          } catch (offlineError: any) {
            console.error('❌ Offline auth also failed:', offlineError.message);
            throw new Error('Unable to connect. Please check your internet connection.');
          }
        }

        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  // Sign out
  const signOut = useMutation({
    mutationFn: async () => {
      const authMode = localStorage.getItem('auth_mode');

      // If offline mode, logout via Gateway
      if (authMode === 'offline') {
        const offlineTokens = getLocalStorage('offline_auth_tokens');
        if (offlineTokens) {
          const tokens = JSON.parse(offlineTokens);
          const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

          try {
            await fetch(`${GATEWAY_URL}/api/auth/logout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refresh_token: tokens.refresh_token }),
            });
          } catch (error) {
            console.warn('⚠️ Offline logout request failed (continuing anyway):', error);
          }

          // Clear offline tokens
          removeLocalStorage('offline_auth_tokens');
          removeLocalStorage('auth_mode');
          return;
        }
      }

      // Online mode - use Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        // Even if Supabase logout fails, clear local storage
        removeLocalStorage('offline_auth_tokens');
        removeLocalStorage('auth_mode');
        throw error;
      }

      // Clear offline tokens if any
      removeLocalStorage('offline_auth_tokens');
      removeLocalStorage('auth_mode');
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });

  // Sign in with OAuth
  const signInWithOAuth = useMutation({
    mutationFn: async (provider: "google" | "github") => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
      });

      if (error) throw error;
      return data;
    },
  });

  // Wrapper functions for easier usage
  const signUpMutation = async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    schoolCode: string;
  }) => {
    return await signUp.mutateAsync(data);
  };

  const signInMutation = async (email: string, password: string) => {
    return await signIn.mutateAsync({ email, password });
  };

  const signOutMutation = async () => {
    await signOut.mutateAsync();
  };

  const signInWithOAuthMutation = async (provider: "google" | "github") => {
    return await signInWithOAuth.mutateAsync(provider);
  };

  return {
    user,
    error,
    isLoading,
    signUp: signUpMutation,
    signIn: signInMutation,
    signOut: signOutMutation,
    signInWithOAuth: signInWithOAuthMutation,
    // Expose mutations for advanced usage
    signUpMutation: signUp,
    signInMutation: signIn,
    signOutMutation: signOut,
    signInWithOAuthMutation: signInWithOAuth,
  };
}
