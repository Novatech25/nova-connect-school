import type { Database } from "../types";
import { getSupabaseClient } from "../client";
import { camelToSnakeKeys, cleanUndefined, snakeToCamelKeys } from "../helpers/transform";

const supabase = getSupabaseClient();

// Types
type AcademicYearInsert = Database["public"]["Tables"]["academic_years"]["Insert"];
type AcademicYearUpdate = Database["public"]["Tables"]["academic_years"]["Update"];

type LevelInsert = Database["public"]["Tables"]["levels"]["Insert"];
type LevelUpdate = Database["public"]["Tables"]["levels"]["Update"];

type ClassInsert = Database["public"]["Tables"]["classes"]["Insert"];
type ClassUpdate = Database["public"]["Tables"]["classes"]["Update"];

type SubjectInsert = Database["public"]["Tables"]["subjects"]["Insert"];
type SubjectUpdate = Database["public"]["Tables"]["subjects"]["Update"];

type SubjectCategoryInsert = Database["public"]["Tables"]["subject_categories"]["Insert"];
type SubjectCategoryUpdate = Database["public"]["Tables"]["subject_categories"]["Update"];

type PeriodInsert = Database["public"]["Tables"]["periods"]["Insert"];
type PeriodUpdate = Database["public"]["Tables"]["periods"]["Update"];

type GradingScaleInsert = Database["public"]["Tables"]["grading_scales"]["Insert"];
type GradingScaleUpdate = Database["public"]["Tables"]["grading_scales"]["Update"];

type CampusInsert = Database["public"]["Tables"]["campuses"]["Insert"];
type CampusUpdate = Database["public"]["Tables"]["campuses"]["Update"];

type RoomInsert = Database["public"]["Tables"]["rooms"]["Insert"];
type RoomUpdate = Database["public"]["Tables"]["rooms"]["Update"];

type TeacherAssignmentInsert =
  Database["public"]["Tables"]["teacher_assignments"]["Insert"];
type TeacherAssignmentUpdate =
  Database["public"]["Tables"]["teacher_assignments"]["Update"];

// ============================================
// ACADEMIC YEARS
// ============================================

export const academicYearQueries = {
  getAll: (schoolId: string) => ({
    queryKey: ["academic_years", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .eq("school_id", schoolId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getCurrent: (schoolId: string) => ({
    queryKey: ["academic_years", schoolId, "current"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_current", true)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ["academic_years", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (academicYear: AcademicYearInsert) => {
      const payload = camelToSnakeKeys(cleanUndefined(academicYear as any));
      const { data, error } = await supabase
        .from("academic_years")
        .insert(payload)
        .select()
        .single();
      if (error) {
        const message =
          error.message || error.details || error.hint || "Failed to create academic year";
        const wrapped = new Error(message);
        (wrapped as any).code = error.code;
        (wrapped as any).details = error.details;
        (wrapped as any).hint = error.hint;
        throw wrapped;
      }
      if (!data) {
        throw new Error("No data returned when creating academic year");
      }
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: AcademicYearUpdate & { id: string }) => {
      const payload = camelToSnakeKeys(cleanUndefined(update as any));
      const { data, error } = await supabase
        .from("academic_years")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        const message =
          error.message || error.details || error.hint || "Failed to update academic year";
        const wrapped = new Error(message);
        (wrapped as any).code = error.code;
        (wrapped as any).details = error.details;
        (wrapped as any).hint = error.hint;
        throw wrapped;
      }
      if (!data) {
        throw new Error("No data returned when updating academic year");
      }
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("academic_years")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};

// ============================================
// LEVELS
// ============================================

export const levelQueries = {
  getAll: (schoolId: string) => ({
    queryKey: ["levels", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("levels")
        .select("*")
        .eq("school_id", schoolId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByType: (schoolId: string, levelType: string) => ({
    queryKey: ["levels", schoolId, levelType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("levels")
        .select("*")
        .eq("school_id", schoolId)
        .eq("level_type", levelType)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (level: LevelInsert) => {
      const payload = camelToSnakeKeys(cleanUndefined(level as any));

      const { data, error } = await supabase
        .from("levels")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: LevelUpdate & { id: string }) => {
      const payload = camelToSnakeKeys(cleanUndefined(update as any));

      const { data, error } = await supabase
        .from("levels")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("levels").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};

// ============================================
// CLASSES
// ============================================

export const classQueries = {
  getAll: (schoolId: string, academicYearId?: string) => ({
    queryKey: ["classes", schoolId, academicYearId],
    queryFn: async () => {
      let query = supabase
        .from("classes")
        .select(
          `
          *,
          level:levels(*),
          academic_year:academic_years(*),
          homeroom_teacher:users(*),
          room:rooms(*)
        `
        )
        .eq("school_id", schoolId);

      if (academicYearId) {
        query = query.eq("academic_year_id", academicYearId);
      }

      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ["classes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(
          `
          *,
          level:levels(*),
          academic_year:academic_years(*),
          homeroom_teacher:users(*),
          room:rooms(*)
        `
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (classData: ClassInsert) => {
      const payload = camelToSnakeKeys(cleanUndefined(classData as any));

      const { data, error } = await supabase
        .from("classes")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: ClassUpdate & { id: string }) => {
      const payload = camelToSnakeKeys(cleanUndefined(update as any));
      const { data, error } = await supabase
        .from("classes")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};

// ============================================
// SUBJECTS
// ============================================

export const subjectQueries = {
  getAll: (schoolId: string, levelId?: string) => ({
    queryKey: ["subjects", schoolId, levelId],
    queryFn: async () => {
      let query = supabase
        .from("subjects")
        .select("*, level:levels(*), category:subject_categories(*)")
        .eq("school_id", schoolId)
        .eq("is_active", true);

      if (levelId) {
        query = query.eq("level_id", levelId);
      }

      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ["subjects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*, level:levels(*), category:subject_categories(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (subject: SubjectInsert) => {
      const payload = camelToSnakeKeys(cleanUndefined(subject as any));
      const { data, error } = await supabase
        .from("subjects")
        .insert(payload)
        .select()
        .single();
      if (error) {
        const message =
          error.message || error.details || error.hint || "Failed to create subject";
        const wrapped = new Error(message);
        (wrapped as any).code = error.code;
        (wrapped as any).details = error.details;
        (wrapped as any).hint = error.hint;
        throw wrapped;
      }
      if (!data) {
        throw new Error("No data returned when creating subject");
      }
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: SubjectUpdate & { id: string }) => {
      const payload = camelToSnakeKeys(cleanUndefined(update as any));
      const { data, error } = await supabase
        .from("subjects")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        const message =
          error.message || error.details || error.hint || "Failed to update subject";
        const wrapped = new Error(message);
        (wrapped as any).code = error.code;
        (wrapped as any).details = error.details;
        (wrapped as any).hint = error.hint;
        throw wrapped;
      }
      if (!data) {
        throw new Error("No data returned when updating subject");
      }
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};

// ============================================
// SUBJECT CATEGORIES (UE)
// ============================================

export const subjectCategoryQueries = {
  getAll: (schoolId: string) => ({
    queryKey: ["subject_categories", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_categories")
        .select("*")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ["subject_categories", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_categories")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (category: SubjectCategoryInsert) => {
      const payload = camelToSnakeKeys(cleanUndefined(category as any));
      const { data, error } = await supabase
        .from("subject_categories")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: SubjectCategoryUpdate & { id: string }) => {
      const payload = camelToSnakeKeys(cleanUndefined(update as any));
      const { data, error } = await supabase
        .from("subject_categories")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subject_categories").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};

// ============================================
// PERIODS
// ============================================

export const periodQueries = {
  getAll: (schoolId: string, academicYearId: string) => ({
    queryKey: ["periods", schoolId, academicYearId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periods")
        .select("*, academic_year:academic_years(*)")
        .eq("school_id", schoolId)
        .eq("academic_year_id", academicYearId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ["periods", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periods")
        .select("*, academic_year:academic_years(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (period: PeriodInsert) => {
      const payload = camelToSnakeKeys(cleanUndefined(period as any));
      const { data, error } = await supabase
        .from("periods")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: PeriodUpdate & { id: string }) => {
      const payload = camelToSnakeKeys(cleanUndefined(update as any));
      const { data, error } = await supabase
        .from("periods")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("periods").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};

// ============================================
// GRADING SCALES
// ============================================

export const gradingScaleQueries = {
  getAll: (schoolId: string) => ({
    queryKey: ["grading_scales", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grading_scales")
        .select("*")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getDefault: (schoolId: string) => ({
    queryKey: ["grading_scales", schoolId, "default"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grading_scales")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_default", true)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ["grading_scales", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grading_scales")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (scale: GradingScaleInsert) => {
      const payload = camelToSnakeKeys(cleanUndefined(scale as any));

      const { data, error } = await supabase
        .from("grading_scales")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({
      id,
      ...update
    }: GradingScaleUpdate & { id: string }) => {
      const payload = camelToSnakeKeys(cleanUndefined(update as any));
      const { data, error } = await supabase
        .from("grading_scales")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("grading_scales")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};

// ============================================
// CAMPUSES
// ============================================

export const campusConfigQueries = {
  getAll: (schoolId: string) => ({
    queryKey: ["campuses", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campuses")
        .select("*")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getMain: (schoolId: string) => ({
    queryKey: ["campuses", schoolId, "main"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campuses")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_main", true)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ["campuses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campuses")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (campus: CampusInsert) => {
      const payload = camelToSnakeKeys(cleanUndefined(campus as any));
      const { data, error } = await supabase
        .from("campuses")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: CampusUpdate & { id: string }) => {
      const payload = camelToSnakeKeys(cleanUndefined(update as any));
      const { data, error } = await supabase
        .from("campuses")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campuses").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};

// ============================================
// ROOMS
// ============================================

export const roomQueries = {
  getAll: (schoolId: string, campusId?: string) => ({
    queryKey: ["rooms", schoolId, campusId],
    queryFn: async () => {
      let query = supabase
        .from("rooms")
        .select("*, campus:campuses(*)")
        .eq("school_id", schoolId);

      if (campusId) {
        query = query.eq("campus_id", campusId);
      }

      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getAvailable: (schoolId: string, campusId?: string) => ({
    queryKey: ["rooms", schoolId, campusId, "available"],
    queryFn: async () => {
      let query = supabase
        .from("rooms")
        .select("*, campus:campuses(*)")
        .eq("school_id", schoolId)
        .eq("is_available", true);

      if (campusId) {
        query = query.eq("campus_id", campusId);
      }

      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ["rooms", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*, campus:campuses(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (room: RoomInsert) => {
      const payload = camelToSnakeKeys(cleanUndefined(room as any));
      const { data, error } = await supabase
        .from("rooms")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: RoomUpdate & { id: string }) => {
      const payload = camelToSnakeKeys(cleanUndefined(update as any));
      const { data, error } = await supabase
        .from("rooms")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};

// ============================================
// TEACHER ASSIGNMENTS
// ============================================

export const teacherAssignmentQueries = {
  getAll: (schoolId: string, academicYearId?: string) => ({
    queryKey: ["teacher_assignments", schoolId, academicYearId],
    queryFn: async () => {
      let query = supabase
        .from("teacher_assignments")
        .select(
          `
          *,
          teacher:users!teacher_id(*),
          class:classes(*),
          subject:subjects(*),
          academic_year:academic_years(*)
        `
        )
        .eq("school_id", schoolId);

      if (academicYearId) {
        query = query.eq("academic_year_id", academicYearId);
      }

      const { data, error } = await query.order("assigned_at", {
        ascending: false,
      });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByTeacher: (teacherId: string, academicYearId?: string) => ({
    queryKey: ["teacher_assignments", "teacher", teacherId, academicYearId],
    queryFn: async () => {
      let query = supabase
        .from("teacher_assignments")
        .select(
          `
          *,
          class:classes(*, level:levels(*)),
          subject:subjects(*),
          academic_year:academic_years(*)
        `
        )
        .eq("teacher_id", teacherId);

      if (academicYearId) {
        query = query.eq("academic_year_id", academicYearId);
      }

      const { data, error } = await query.order("assigned_at", {
        ascending: false,
      });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByClass: (classId: string) => ({
    queryKey: ["teacher_assignments", "class", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_assignments")
        .select(
          `
          *,
          teacher:users!teacher_id(*),
          subject:subjects(*)
        `
        )
        .eq("class_id", classId);
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (assignment: TeacherAssignmentInsert) => {
      const payload = camelToSnakeKeys(cleanUndefined(assignment as any));

      const { data, error } = await supabase
        .from("teacher_assignments")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  createBulk: () => ({
    mutationFn: async (assignments: TeacherAssignmentInsert[]) => {
      const payload = assignments.map((item) => camelToSnakeKeys(cleanUndefined(item as any)));

      const { data, error } = await supabase
        .from("teacher_assignments")
        .insert(payload)
        .select();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({
      id,
      ...update
    }: TeacherAssignmentUpdate & { id: string }) => {
      const payload = camelToSnakeKeys(cleanUndefined(update as any));
      const { data, error } = await supabase
        .from("teacher_assignments")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("teacher_assignments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};
