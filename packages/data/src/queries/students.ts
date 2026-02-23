import {
  camelToSnakeKeys,
  snakeToCamelKeys,
  cleanUndefined,
  gatewayRequest,
  getSyncStrategy,
  runWithStrategy,
} from "../helpers";
import { getSupabaseClient } from "../client";
import type {
  Student,
  CreateStudent,
  UpdateStudent,
  Parent,
  CreateParent,
  UpdateParent,
  StudentParentRelation,
  CreateStudentParentRelation,
  Enrollment,
  CreateEnrollment,
  UpdateEnrollment,
  StudentDocument,
  CreateStudentDocument,
} from "@novaconnect/core";

// ============================================
// STUDENTS
// ============================================

export const studentQueries = {
  getAll: (schoolId: string, filters?: { status?: string; classId?: string }) => ({
    queryKey: ["students", schoolId, filters],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const strategy = getSyncStrategy();

      console.log('🔍 studentQueries.getAll - schoolId:', schoolId, 'filters:', filters, 'strategy:', strategy);

      const getFromSupabase = async () => {
        console.log('🔵 Fetching students from Supabase for school:', schoolId);
        let query = supabase
          .from("students")
          .select(
            `
            *,
            user:users(*),
            enrollments:enrollments(
              *,
              class:classes!enrollments_class_id_fkey(*),
              academic_year:academic_years(*)
            )
          `
          )
          .eq("school_id", schoolId)
          .order("last_name", { ascending: true });

        if (filters?.status) {
          query = query.eq("status", filters.status as any);
        }

        /* 
         * ⚠️ DISABLED BACKEND CLASS FILTER
         * Filtering on embedded resource 'enrollments.class_id' can cause the enrollments array 
         * to be empty for non-matching classes, while still returning the student.
         * The frontend logic handles filtering based on the full list of enrollments.
         * This avoids "missing student" issues when the student relies on specific enrollment data.
         */
        // if (filters?.classId) {
        //   query = query.eq("enrollments.class_id", filters.classId);
        // }

        const { data, error } = await query;
        if (error) {
          console.error('❌ Supabase query error (students.getAll):', error);
          throw error;
        }
        console.log(`✅ Loaded ${data?.length || 0} students from Supabase`);

        // Debug enrollments for returned students
        if (data && data.length > 0) {
          data.forEach((s: any) => {
            // Only log name and enrollment count to avoid clutter
            // console.log(`  - ${s.first_name} ${s.last_name} (${s.matricule}): ${s.enrollments?.length || 0} enrollments`);
          });
        }

        return snakeToCamelKeys(data);
      };

      const getFromGateway = async () => {
        const params = new URLSearchParams();
        if (filters?.status) params.set('status', filters.status);
        if (filters?.classId) params.set('classId', filters.classId);

        // Utiliser l'endpoint admin qui ne nécessite pas d'auth
        const data = await gatewayRequest(
          `/admin/students?${params.toString()}`,
          { method: "GET" },
          supabase,
          schoolId
        );

        return data;
      };

      return runWithStrategy({
        strategy,
        gateway: getFromGateway,
        supabase: getFromSupabase,
      });
    },
  }),

  getById: (id: string) => ({
    queryKey: ["students", id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("students")
        .select(
          `
          *,
          user:users(*),
          enrollments:enrollments(
            *,
            class:classes!enrollments_class_id_fkey(*),
            academic_year:academic_years(*)
          ),
          parents:student_parent_relations(
            *,
            parent:parents(*)
          ),
          documents:student_documents(*)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByMatricule: (schoolId: string, matricule: string) => ({
    queryKey: ["students", "matricule", schoolId, matricule],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("school_id", schoolId)
        .eq("matricule", matricule)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (student: CreateStudent) => {
      const supabase = getSupabaseClient();
      const strategy = getSyncStrategy();

      const createInSupabase = async () => {
        // Clean undefined values before converting to snake_case
        // This prevents sending undefined as null which can violate unique constraints
        const cleanedStudent = cleanUndefined(student);
        const { data, error } = await supabase
          .from("students")
          .insert(camelToSnakeKeys(cleanedStudent))
          .select()
          .single();

        if (error) throw error;
        return snakeToCamelKeys(data);
      };

      const createInGateway = async () => {
        const data = await gatewayRequest(
          "/admin/students",
          {
            method: "POST",
            body: JSON.stringify(student),
          },
          supabase,
          student.schoolId
        );

        return snakeToCamelKeys(data);
      };

      return runWithStrategy({
        strategy,
        gateway: createInGateway,
        supabase: createInSupabase,
      });
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...updates }: UpdateStudent) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("students")
        .update(camelToSnakeKeys(updates))
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("students").delete().eq("id", id);

      if (error) throw error;
      return { id };
    },
  }),

  // Get current student based on authenticated user
  getCurrent: () => ({
    queryKey: ["current_student"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      console.log('🔍 getCurrentStudent - user.id:', user.id);

      // First try to get student record linked to user
      const { data, error } = await supabase
        .from("students")
        .select(`
          *,
          school:schools(*)
        `)
        .eq("user_id", user.id)
        .single();

      console.log('🔍 getCurrentStudent - student data:', data, 'error:', error);

      if (error) {
        if (error.code === 'PGRST116') {
          // No student found for this user - try to get school_id and create student record
          console.log('⚠️ No student found, attempting to create one...');

          // Get school_id from users table
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("school_id, first_name, last_name, email")
            .eq("id", user.id)
            .single();

          if (userError || !userData?.school_id) {
            console.log('❌ Cannot get user data:', userError);
            return null;
          }

          console.log('📋 Creating student for user:', userData);

          // Create student record
          const { data: newStudent, error: createError } = await supabase
            .from("students")
            .insert({
              school_id: userData.school_id,
              user_id: user.id,
              matricule: `TEMP-${Date.now()}`, // Temporary matricule
              first_name: userData.first_name || user.user_metadata?.firstName || 'Étudiant',
              last_name: userData.last_name || user.user_metadata?.lastName || '',
              date_of_birth: new Date().toISOString().split('T')[0], // Default date
              gender: 'other',
              status: 'active',
            })
            .select(`
              *,
              school:schools(*)
            `)
            .single();

          if (createError) {
            console.log('❌ Failed to create student:', createError);
            return null;
          }

          console.log('✅ Created student:', newStudent);
          return snakeToCamelKeys(newStudent) as Student;
        }
        throw error;
      }

      return snakeToCamelKeys(data) as Student;
    },
  }),

  // Ensure student exists for current user (create if needed)
  ensureCurrentStudent: () => ({
    mutationFn: async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      console.log('🔍 ensureCurrentStudent - Starting...');

      if (!user) {
        console.error('❌ User not authenticated');
        throw new Error('User not authenticated');
      }

      console.log('✅ User authenticated:', user.id);

      // Check if student exists
      const { data: existingStudent, error: checkError } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();

      console.log('🔍 Existing student check:', existingStudent, 'error:', checkError);

      if (existingStudent) {
        console.log('✅ Student already exists:', existingStudent);
        return snakeToCamelKeys(existingStudent);
      }

      // Get user data
      console.log('📋 Fetching user data...');
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("school_id, first_name, last_name, email")
        .eq("id", user.id)
        .single();

      console.log('📋 User data:', userData, 'error:', userError);

      if (userError) {
        console.error('❌ Error fetching user data:', userError);
        throw new Error(`Error fetching user data: ${userError.message}`);
      }

      if (!userData?.school_id) {
        console.error('❌ User not associated with a school');
        throw new Error('User not associated with a school. Please contact administration.');
      }

      // Prepare student data
      // Calculate a valid date of birth (must be <= CURRENT_DATE per constraint)
      // Use 18 years ago as default for adult students
      const defaultBirthDate = new Date();
      defaultBirthDate.setFullYear(defaultBirthDate.getFullYear() - 18);

      const studentData = {
        school_id: userData.school_id,
        user_id: user.id,
        matricule: `STU-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // More unique
        first_name: userData.first_name || user.user_metadata?.firstName || 'Étudiant',
        last_name: userData.last_name || user.user_metadata?.lastName || '',
        date_of_birth: defaultBirthDate.toISOString().split('T')[0], // 18 years ago
        gender: 'other' as const,
        status: 'active' as const,
      };

      console.log('📝 Creating student with data:', studentData);

      // Create student record
      const { data: newStudent, error: createError } = await supabase
        .from("students")
        .insert(studentData)
        .select()
        .single();

      if (createError) {
        console.error('❌ Failed to create student:', createError);
        console.error('Error details:', {
          message: createError.message,
          code: createError.code,
          details: createError.details,
          hint: createError.hint,
        });
        throw new Error(`Failed to create student record: ${createError.message}`);
      }

      console.log('✅ Student created successfully:', newStudent);
      return snakeToCamelKeys(newStudent);
    },
  }),
};

// ============================================
// PARENTS
// ============================================

export const parentQueries = {
  getAll: (schoolId: string) => ({
    queryKey: ["parents", schoolId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("parents")
        .select(
          `
          *,
          user:users(*),
          students:student_parent_relations(
            *,
            student:students(*)
          )
        `
        )
        .eq("school_id", schoolId)
        .order("last_name", { ascending: true });

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ["parents", id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("parents")
        .select(
          `
          *,
          user:users(*),
          students:student_parent_relations(
            *,
            student:students(*)
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByStudentId: (studentId: string) => ({
    queryKey: ["parents", "student", studentId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const strategy = getSyncStrategy();

      const getFromSupabase = async () => {
        const { data, error } = await supabase
          .from("student_parent_relations")
          .select(
            `
            *,
            parent:parents(*)
          `
          )
          .eq("student_id", studentId);

        if (error) throw error;
        return snakeToCamelKeys(data);
      };

      const getFromGateway = async () => {
        const data = await gatewayRequest(
          `/parents?studentId=${encodeURIComponent(studentId)}`,
          { method: "GET" },
          supabase
        );
        return snakeToCamelKeys(data);
      };

      return runWithStrategy({
        strategy,
        gateway: getFromGateway,
        supabase: getFromSupabase,
      });
    },
  }),

  create: () => ({
    mutationFn: async (parent: CreateParent) => {
      const supabase = getSupabaseClient();
      const strategy = getSyncStrategy();

      const createInSupabase = async () => {
        const { data, error } = await supabase
          .from("parents")
          .insert(camelToSnakeKeys(parent))
          .select()
          .single();

        if (error) throw error;
        return snakeToCamelKeys(data);
      };

      const createInGateway = async () => {
        const data = await gatewayRequest(
          "/parents",
          {
            method: "POST",
            body: JSON.stringify(parent),
          },
          supabase,
          parent.schoolId
        );

        return snakeToCamelKeys(data);
      };

      return runWithStrategy({
        strategy,
        gateway: createInGateway,
        supabase: createInSupabase,
      });
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...updates }: UpdateParent) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("parents")
        .update(camelToSnakeKeys(updates))
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("parents").delete().eq("id", id);

      if (error) throw error;
      return { id };
    },
  }),

  getCurrent: () => ({
    queryKey: ["current_parent"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return null;

      const { data, error } = await supabase
        .from("parents")
        .select(
          `
          *,
          user:users(*),
          students:student_parent_relations(
            *,
            student:students(
              *,
              enrollments:enrollments(
                *,
                class:classes(*),
                academic_year:academic_years(*)
              )
            )
          )
        `
        )
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No parent found
        throw error;
      }
      return snakeToCamelKeys(data);
    },
  }),

  getByEmail: (schoolId: string, email: string) => ({
    queryKey: ["parents", "email", email],
    queryFn: async () => {
      if (!email) return null;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("parents")
        .select("*")
        .eq("school_id", schoolId)
        .eq("email", email)
        .maybeSingle();

      if (error) throw error;
      return data ? snakeToCamelKeys(data) : null;
    },
    retry: false,
    enabled: !!email && !!schoolId,
  }),
};

// ============================================
// STUDENT-PARENT RELATIONS
// ============================================

export const studentParentRelationQueries = {
  create: () => ({
    mutationFn: async (relation: CreateStudentParentRelation) => {
      const supabase = getSupabaseClient();
      const strategy = getSyncStrategy();

      const createInSupabase = async () => {
        const { data, error } = await supabase
          .from("student_parent_relations")
          .insert(camelToSnakeKeys(relation))
          .select()
          .single();

        if (error) throw error;
        return snakeToCamelKeys(data);
      };

      const createInGateway = async () => {
        const data = await gatewayRequest(
          "/student-parent-relations",
          {
            method: "POST",
            body: JSON.stringify(relation),
          },
          supabase,
          relation.schoolId
        );

        return snakeToCamelKeys(data);
      };

      return runWithStrategy({
        strategy,
        gateway: createInGateway,
        supabase: createInSupabase,
      });
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("student_parent_relations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id };
    },
  }),
};

// ============================================
// ENROLLMENTS
// ============================================

export const enrollmentQueries = {
  getAll: (schoolId: string, academicYearId?: string) => ({
    queryKey: ["enrollments", schoolId, academicYearId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("enrollments")
        .select(
          `
          *,
          student:students(*),
          class:classes!enrollments_class_id_fkey(*),
          academic_year:academic_years(*)
        `
        )
        .eq("school_id", schoolId);

      if (academicYearId) {
        query = query.eq("academic_year_id", academicYearId);
      }

      const { data, error } = await query.order("enrollment_date", {
        ascending: false,
      });

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByStudentId: (studentId: string) => ({
    queryKey: ["enrollments", "student", studentId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("enrollments")
        .select(
          `
          *,
          class:classes!enrollments_class_id_fkey(*),
          academic_year:academic_years(*)
        `
        )
        .eq("student_id", studentId)
        .order("enrollment_date", { ascending: false });

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByClassId: (classId: string) => ({
    queryKey: ["enrollments", "class", classId],
    queryFn: async () => {
      const supabase = getSupabaseClient();

      console.log('[enrollmentQueries.getByClassId] Fetching enrollments for classId:', classId);

      const { data, error } = await supabase
        .from("enrollments")
        .select(
          `
          *,
          student:students(*)
        `
        )
        .eq("class_id", classId)
        // Only enrolled students (active enrollments)
        .eq("status", "enrolled");
      // Note: Removed .order("student.last_name") - cannot sort by relation in PostgREST

      console.log('[enrollmentQueries.getByClassId] Result:', {
        count: data?.length || 0,
        error: error?.message
      });

      if (error) {
        console.error('[enrollmentQueries.getByClassId] Error:', error);
        throw error;
      }

      // Sort by student last name client-side
      const sorted = data?.sort((a: any, b: any) => {
        const lastNameA = a.student?.last_name || a.student?.lastName || '';
        const lastNameB = b.student?.last_name || b.student?.lastName || '';
        return lastNameA.localeCompare(lastNameB);
      });

      return snakeToCamelKeys(sorted);
    },
  }),

  create: () => ({
    mutationFn: async (enrollment: CreateEnrollment) => {
      const supabase = getSupabaseClient();
      const strategy = getSyncStrategy();

      console.log('📝 enrollmentQueries.create - Input:', enrollment);
      console.log('📝 Sync strategy:', strategy);

      const createInSupabase = async () => {
        console.log('🔵 Creating enrollment in Supabase...');
        console.log('📦 Enrollment data before cleaning:', enrollment);

        // Clean undefined values before converting to snake_case
        // This prevents sending undefined as null to database
        const cleanedEnrollment = cleanUndefined(enrollment);
        console.log('📦 Enrollment data after cleaning:', cleanedEnrollment);

        const { data, error } = await supabase
          .from("enrollments")
          .insert(camelToSnakeKeys(cleanedEnrollment))
          .select()
          .single();

        if (error) {
          console.error('❌ Supabase enrollment creation error:', error);
          throw error;
        }
        console.log('✅ Enrollment created in Supabase:', data);
        return snakeToCamelKeys(data);
      };

      const createInGateway = async () => {
        console.log('🟠 Creating enrollment in Gateway...');
        const data = await gatewayRequest(
          "/enrollments",
          {
            method: "POST",
            body: JSON.stringify(enrollment),
          },
          supabase,
          enrollment.schoolId
        );

        console.log('✅ Enrollment created in Gateway:', data);
        return snakeToCamelKeys(data);
      };

      return runWithStrategy({
        strategy,
        gateway: createInGateway,
        supabase: createInSupabase,
      });
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...updates }: UpdateEnrollment) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("enrollments")
        .update(camelToSnakeKeys(updates))
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("enrollments").delete().eq("id", id);

      if (error) throw error;
      return { id };
    },
  }),
};

// ============================================
// STUDENT DOCUMENTS (Legacy - kept for backward compatibility)
// Use studentDocumentQueries from './studentDocuments.ts' for new code
// ============================================

export const studentDocumentLegacyQueries = {
  getByStudentId: (studentId: string) => ({
    queryKey: ["student_documents", studentId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("student_documents")
        .select(
          `
          *,
          uploaded_by_user:users!uploaded_by(*)
        `
        )
        .eq("student_id", studentId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (document: CreateStudentDocument) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("student_documents")
        .insert(camelToSnakeKeys(document as any))
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("student_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id };
    },
  }),
};
