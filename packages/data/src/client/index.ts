import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL or Anon Key is missing. Please check your environment variables.");
}

// Typed Supabase Client
export type NovaConnectClient = SupabaseClient<Database>;

// Singleton client for web
let webClient: NovaConnectClient | null = null;

export const getSupabaseClient = (): NovaConnectClient => {
  if (!webClient) {
    webClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });

    // Synchronously set up auth for Edge Functions
    // The session should be available immediately from localStorage
    const setupEdgeFunctionAuth = async () => {
      const { data: { session } } = await webClient.auth.getSession();
      const accessToken = session?.access_token;
      if (accessToken) {
        webClient?.functions.setAuth(accessToken);
      }
    };

    // Call immediately and also set up listeners for future changes
    setupEdgeFunctionAuth().catch(err => {
      console.warn('Failed to set initial Edge Function auth:', err);
    });

    webClient.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token;
      if (accessToken) {
        webClient?.functions.setAuth(accessToken);
      } else {
        webClient?.functions.setAuth(undefined);
      }
    });
  }
  return webClient;
};

// Create a new client instance (useful for server-side or specific use cases)
export const createSupabaseClient = (): NovaConnectClient => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
    },
  });
};

export default getSupabaseClient;

// Alias pour compatibilité avec les imports directs
export const supabase = getSupabaseClient;
