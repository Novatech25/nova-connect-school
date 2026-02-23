import type { Database } from "../types";
import { getSupabaseClient } from "../client";

const supabase = getSupabaseClient();

type LicenseInsert = Database["public"]["Tables"]["licenses"]["Insert"];
type LicenseUpdate = Database["public"]["Tables"]["licenses"]["Update"];
type LicenseActivationInsert = Database["public"]["Tables"]["license_activations"]["Insert"];

export const licenseQueries = {
  // Get all licenses with optional filters
  getAll: (filters?: {
    school_id?: string;
    status?: string;
    license_type?: string;
    search?: string;
    expires_before?: Date;
    expires_after?: Date;
  }) => ({
    queryKey: ["licenses", filters],
    queryFn: async () => {
      let query = supabase
        .from("licenses")
        .select(`
          *,
          school:schools(
            id,
            name,
            code,
            city,
            country
          ),
          creator:users(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order("created_at", { ascending: false });

      if (filters?.school_id) {
        query = query.eq("school_id", filters.school_id);
      }

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.license_type) {
        query = query.eq("license_type", filters.license_type);
      }

      if (filters?.search) {
        query = query.or(`license_key.ilike.%${filters.search}%,school.name.ilike.%${filters.search}%`);
      }

      if (filters?.expires_before) {
        query = query.lte("expires_at", filters.expires_before.toISOString());
      }

      if (filters?.expires_after) {
        query = query.gte("expires_at", filters.expires_after.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  }),

  // Get license by ID
  getById: (id: string) => ({
    queryKey: ["licenses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select(`
          *,
          school:schools(
            id,
            name,
            code,
            city,
            country,
            subscription_plan
          ),
          creator:users(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Get license by key
  getByKey: (key: string) => ({
    queryKey: ["licenses", "key", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select(`
          *,
          school:schools(
            id,
            name,
            code
          )
        `)
        .eq("license_key", key)
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Get licenses by school
  getBySchool: (schoolId: string) => ({
    queryKey: ["licenses", "school", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  }),

  // Get license activations
  getActivations: (licenseId: string) => ({
    queryKey: ["license-activations", licenseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("license_activations")
        .select(`
          *,
          school:schools(
            id,
            name,
            code
          )
        `)
        .eq("license_id", licenseId)
        .order("activated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  }),

  // Get license statistics
  getStats: () => ({
    queryKey: ["license-stats"],
    queryFn: async () => {
      const { data: licenses, error } = await supabase
        .from("licenses")
        .select("status, license_type, expires_at");

      if (error) throw error;

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const stats = {
        total: licenses.length,
        active: 0,
        expired: 0,
        revoked: 0,
        suspended: 0,
        byType: {} as Record<string, number>,
        expiringSoon: 0,
      };

      licenses.forEach((license) => {
        // Count by status
        if (license.status === "active") stats.active++;
        else if (license.status === "expired") stats.expired++;
        else if (license.status === "revoked") stats.revoked++;
        else if (license.status === "suspended") stats.suspended++;

        // Count by type
        stats.byType[license.license_type] = (stats.byType[license.license_type] || 0) + 1;

        // Count expiring soon (active licenses expiring within 30 days)
        if (license.status === "active") {
          const expiresAt = new Date(license.expires_at);
          if (expiresAt <= thirtyDaysFromNow) {
            stats.expiringSoon++;
          }
        }
      });

      return stats;
    },
  }),

  // Create license (uses Edge Function to generate license_key)
  create: () => ({
    mutationFn: async (license: Omit<LicenseInsert, "license_key">) => {
      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      // Call Edge Function to generate license
      const { data, error } = await supabase.functions.invoke("generate-license", {
        body: {
          school_id: license.school_id,
          license_type: license.license_type,
          expires_at: license.expires_at,
          max_activations: license.max_activations,
          metadata: license.metadata,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data.license;
    },
  }),

  // Update license
  update: () => ({
    mutationFn: async ({ id, ...update }: LicenseUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("licenses")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Revoke license
  revoke: () => ({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("licenses")
        .update({ status: "revoked" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Delete license
  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("licenses").delete().eq("id", id);

      if (error) throw error;
      return id;
    },
  }),

  // Create license activation
  createActivation: () => ({
    mutationFn: async (activation: LicenseActivationInsert) => {
      const { data, error } = await supabase
        .from("license_activations")
        .insert(activation)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Deactivate license activation
  deactivateActivation: () => ({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("license_activations")
        .update({ status: "deactivated", deactivated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),
};
