import type { Database } from "../types";
import { getSupabaseClient } from "../client";
import type { SchoolSettings } from "@novaconnect/core";

const supabase = getSupabaseClient();

type SchoolUpdate = Database["public"]["Tables"]["schools"]["Update"];

export const schoolSettingsQueries = {
  // Get school settings
  get: (schoolId: string) => ({
    queryKey: ["school_settings", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("settings")
        .eq("id", schoolId)
        .single();

      if (error) throw error;
      return (data?.settings as SchoolSettings) || null;
    },
  }),

  // Update school settings via API to ensure proper merge and audit
  update: () => ({
    mutationFn: async ({ schoolId, settings }: { schoolId: string; settings: Partial<SchoolSettings> }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      if (typeof window !== 'undefined') {
        const authMode = window.localStorage.getItem('auth_mode');
        if (authMode) {
          headers['X-Auth-Mode'] = authMode;
        }
        if (!headers.Authorization) {
          const rawTokens = window.localStorage.getItem('offline_auth_tokens');
          if (rawTokens) {
            try {
              const parsed = JSON.parse(rawTokens);
              if (parsed?.access_token) {
                headers.Authorization = `Bearer ${parsed.access_token}`;
              }
            } catch {
              // ignore invalid cache
            }
          }
        }
        if (!headers.Authorization) {
          const storageKeys = Object.keys(window.localStorage);
          const supabaseKey = storageKeys.find((key) =>
            key.startsWith('sb-') && key.endsWith('-auth-token')
          );
          if (supabaseKey) {
            try {
              const raw = window.localStorage.getItem(supabaseKey);
              const parsed = raw ? JSON.parse(raw) : null;
              if (parsed?.access_token) {
                headers.Authorization = `Bearer ${parsed.access_token}`;
              }
            } catch {
              // ignore invalid cache
            }
          }
        }
      }

      // Use API route for proper merge logic and audit logging
      const response = await fetch(`/api/school-config/settings?schoolId=${schoolId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      return await response.json();
    },
  }),
};
