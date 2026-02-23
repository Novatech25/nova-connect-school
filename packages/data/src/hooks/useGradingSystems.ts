import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../client";
import type {
  CreateGradingSystemSchema,
  UpdateGradingSystemSchema,
} from "@novaconnect/core/schemas";

// ============================================
// GRADING SYSTEMS HOOKS
// ============================================

export function useGradingSystems(schoolId: string) {
  return useQuery({
    queryKey: ["grading_systems", schoolId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("grading_systems")
        .select(`
          *,
          level:levels(id, name, code, level_type)
        `)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });
}

export function useGradingSystem(id: string) {
  return useQuery({
    queryKey: ["grading_systems", id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("grading_systems")
        .select(`
          *,
          level:levels(id, name, code, level_type)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateGradingSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGradingSystemSchema) => {
      const supabase = getSupabaseClient();
      const { data: result, error } = await supabase
        .from("grading_systems")
        .insert({
          school_id: data.schoolId,
          level_id: data.levelId,
          name: data.name,
          system_type: data.systemType,
          max_score: data.maxScore,
          min_passing_score: data.minPassingScore,
          passing_grade: data.passingGrade,
          max_gpa: data.maxGpa,
          grade_scale_config: data.gradeScaleConfig,
          min_credits_to_pass: data.minCreditsToPass,
          total_credits_required: data.totalCreditsRequired,
          is_level_specific: data.isLevelSpecific,
          is_default: data.isDefault,
          is_active: data.isActive,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grading_systems"] });
    },
  });
}

export function useUpdateGradingSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateGradingSystemSchema) => {
      const supabase = getSupabaseClient();

      // Build update object dynamically
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.systemType !== undefined) updateData.system_type = data.systemType;
      if (data.maxScore !== undefined) updateData.max_score = data.maxScore;
      if (data.minPassingScore !== undefined) updateData.min_passing_score = data.minPassingScore;
      if (data.passingGrade !== undefined) updateData.passing_grade = data.passingGrade;
      if (data.maxGpa !== undefined) updateData.max_gpa = data.maxGpa;
      if (data.gradeScaleConfig !== undefined) updateData.grade_scale_config = data.gradeScaleConfig;
      if (data.minCreditsToPass !== undefined) updateData.min_credits_to_pass = data.minCreditsToPass;
      if (data.totalCreditsRequired !== undefined) updateData.total_credits_required = data.totalCreditsRequired;
      if (data.isLevelSpecific !== undefined) updateData.is_level_specific = data.isLevelSpecific;
      if (data.isDefault !== undefined) updateData.is_default = data.isDefault;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;

      const { data: result, error } = await supabase
        .from("grading_systems")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grading_systems"] });
    },
  });
}

export function useDeleteGradingSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("grading_systems")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grading_systems"] });
    },
  });
}

// ============================================
// QUICK SETUP HELPER HOOKS
// ============================================

export function useQuickSetupPrimary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      schoolId: string;
      levelId: string;
      scaleName?: string;
    }) => {
      const supabase = getSupabaseClient();

      // Call the SQL function
      const { data, error } = await supabase.rpc("setup_primary_grading", {
        p_school_id: params.schoolId,
        p_level_id: params.levelId,
        p_scale_name: params.scaleName || "Échelle Primaire (0-10)",
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grading_systems"] });
    },
  });
}

export function useQuickSetupSecondary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      schoolId: string;
      levelId: string;
      scaleName?: string;
    }) => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc("setup_secondary_grading", {
        p_school_id: params.schoolId,
        p_level_id: params.levelId,
        p_scale_name: params.scaleName || "Échelle Secondaire (0-20)",
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grading_systems"] });
    },
  });
}

export function useQuickSetupUniversity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      schoolId: string;
      levelId: string;
      totalCredits: number;
      passingGpa: number;
    }) => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc("setup_university_grading", {
        p_school_id: params.schoolId,
        p_level_id: params.levelId,
        p_total_credits: params.totalCredits,
        p_passing_gpa: params.passingGpa,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grading_systems"] });
    },
  });
}

export function useQuickSetupVocational() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      schoolId: string;
      levelId: string;
      totalCredits: number;
    }) => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc("setup_vocational_grading", {
        p_school_id: params.schoolId,
        p_level_id: params.levelId,
        p_total_credits: params.totalCredits,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grading_systems"] });
    },
  });
}
