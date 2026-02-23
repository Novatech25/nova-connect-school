import type { Database } from "../types";
import { getSupabaseClient } from "../client";

const supabase = getSupabaseClient();

type SchoolInsert = Database["public"]["Tables"]["schools"]["Insert"];
type SchoolUpdate = Database["public"]["Tables"]["schools"]["Update"];

export const schoolQueries = {
  // Get all schools
  getAll: () => ({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  }),

  // Get school by ID
  getById: (id: string) => ({
    queryKey: ["schools", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Get school by code
  getByCode: (code: string) => ({
    queryKey: ["schools", "code", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .eq("code", code)
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Create school
  create: () => ({
    mutationFn: async (school: SchoolInsert) => {
      const { data, error } = await supabase
        .from("schools")
        .insert(school)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Update school
  update: () => ({
    mutationFn: async ({ id, ...update }: SchoolUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("schools")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Delete school
  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schools").delete().eq("id", id);

      if (error) throw error;
      return id;
    },
  }),
};
