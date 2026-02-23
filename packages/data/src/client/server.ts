import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "../types";
import type { NovaConnectClient } from "./";

/**
 * Creates a Supabase client for server-side usage with cookie handling
 * Use this in Next.js Server Components and Route Handlers
 */
export const createServerClient = async (): Promise<NovaConnectClient> => {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL or Anon Key is missing. Please check your environment variables.");
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: (key: string) => {
          return cookieStore.get(key)?.value ?? null;
        },
        setItem: (key: string, value: string) => {
          cookieStore.set({ name: key, value, ...getCookieOptions() });
        },
        removeItem: (key: string) => {
          cookieStore.delete({ name: key, ...getCookieOptions() });
        },
      },
    },
  });
};

/**
 * Creates a Supabase client with service role privileges
 * Use this ONLY for admin operations on the server
 * Never expose this client to the client-side
 */
export const createServiceClient = (): NovaConnectClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase URL or Service Role Key is missing. Please check your environment variables.");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/**
 * Helper to get consistent cookie options
 */
const getCookieOptions = () => {
  return {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  };
};

/**
 * Type for the server client
 */
export type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Get the authenticated user from the server
 * Use this in Next.js Route Handlers to get the current user
 * @returns The user object or null if not authenticated
 */
export const getServerUser = async () => {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Alias for createServerClient for convenience
 * @deprecated Use createServerClient instead
 */
export const getSupabaseServerClient = createServerClient;
