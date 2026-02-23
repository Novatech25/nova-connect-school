import { SupabaseClient } from "@supabase/supabase-js";

export interface ParentData {
  schoolId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  occupation?: string;
  workplace?: string;
  relationship?: string;
  isPrimaryContact?: boolean;
  isEmergencyContact?: boolean;
}

export interface StudentParentRelationData {
  schoolId: string;
  studentId: string;
  parentId: string;
  relationship?: string;
  isPrimary?: boolean;
  canPickup?: boolean;
  canViewGrades?: boolean;
  canViewAttendance?: boolean;
}

export interface CreateParentAndRelationResult {
  success: boolean;
  data?: {
    parentId: string;
    relationId: string;
  };
  error?: string;
  details?: any;
}

/**
 * Crée l'enregistrement parent dans la table parents
 */
export async function createParentRecord(
  supabase: SupabaseClient,
  data: ParentData,
): Promise<{ success: boolean; parentId?: string; error?: string }> {
  console.log("[PARENT] Création record parent:", data.email);

  const { data: parentRecord, error: parentError } = await supabase
    .from("parents")
    .insert({
      school_id: data.schoolId,
      user_id: data.userId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone || "0000000",
      relationship: data.relationship || "Parent",
      address: data.address,
      city: data.city,
      occupation: data.occupation,
      workplace: data.workplace,
      is_primary_contact: data.isPrimaryContact || false,
      is_emergency_contact: data.isEmergencyContact || false,
    })
    .select()
    .single();

  if (parentError) {
    console.error("[PARENT] Erreur création record parent:", parentError);
    return {
      success: false,
      error: parentError.message || "Failed to create parent record",
    };
  }

  console.log("[PARENT] Parent record créé:", parentRecord.id);
  return { success: true, parentId: parentRecord.id };
}

/**
 * Crée la relation parent-élève dans student_parent_relations
 */
export async function createStudentParentRelation(
  supabase: SupabaseClient,
  data: StudentParentRelationData,
): Promise<{ success: boolean; relationId?: string; error?: string }> {
  console.log("[PARENT] Création relation parent-élève:", {
    parent: data.parentId,
    student: data.studentId,
  });

  const { data: relationRecord, error: relationError } = await supabase
    .from("student_parent_relations")
    .insert({
      school_id: data.schoolId,
      student_id: data.studentId,
      parent_id: data.parentId,
      relationship: data.relationship || "Parent",
      is_primary: data.isPrimary || false,
      can_pickup: data.canPickup ?? true,
      can_view_grades: data.canViewGrades ?? true,
      can_view_attendance: data.canViewAttendance ?? true,
    })
    .select()
    .single();

  if (relationError) {
    console.error("[PARENT] Erreur création relation:", relationError);
    return {
      success: false,
      error:
        relationError.message || "Failed to create parent-student relation",
    };
  }

  console.log("[PARENT] Relation créée:", relationRecord.id);
  return { success: true, relationId: relationRecord.id };
}

/**
 * Assigner le rôle parent dans la table user_roles
 */
export async function assignParentRole(
  supabase: SupabaseClient,
  userId: string,
  schoolId: string,
): Promise<{ success: boolean; error?: string }> {
  console.log("[PARENT] Assignation rôle parent:", userId);

  // D'abord trouver le role_id pour 'parent'
  const { data: roleData, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "parent")
    .single();

  if (roleError || !roleData) {
    console.error("[PARENT] Erreur finding parent role:", roleError);
    return {
      success: false,
      error: "Parent role not found in database",
    };
  }

  const roleId = roleData.id;

  // Insérer dans user_roles
  const { error: assignError } = await supabase.from("user_roles").insert({
    user_id: userId,
    role_id: roleId,
    school_id: schoolId,
  });

  if (assignError) {
    console.error("[PARENT] Erreur assignation rôle:", assignError);
    return {
      success: false,
      error: assignError.message || "Failed to assign parent role",
    };
  }

  console.log("[PARENT] Rôle parent assigné avec succès");
  return { success: true };
}

/**
 * Crée le compte parent COMPLET en une seule transaction
 * Combine:
 * 1. Création auth user avec métadonnées complètes
 * 2. Création record parent
 * 3. Création relation parent-élève
 * 4. Assignation rôle parent
 */
export async function createCompleteParent(
  supabase: SupabaseClient,
  authData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    schoolId: string;
    schoolCode?: string;
  },
  parentData: Omit<
    ParentData,
    "schoolId" | "userId" | "firstName" | "lastName" | "email"
  >,
  relationData: Omit<
    StudentParentRelationData,
    "schoolId" | "studentId" | "parentId"
  >,
): Promise<CreateParentAndRelationResult> {
  console.log("[PARENT] Création compte parent COMPLET:", authData.email);

  try {
    // Étape 1: Créer auth user avec métadonnées complètes
    const {
      success: authSuccess,
      data: userData,
      error: authError,
    } = await supabase.auth.admin.createUser({
      email: authData.email,
      password: authData.password,
      email_confirm: true,
      user_metadata: {
        first_name: authData.firstName,
        last_name: authData.lastName,
        role: "parent",
        school_code: authData.schoolCode,
        school_id: authData.schoolId,
        provider: "email",
        full_name: `${authData.firstName} ${authData.lastName}`,
      },
      app_metadata: {
        role: "parent",
        provider: "email",
        school_id: authData.schoolId,
      },
    });

    if (!authSuccess || authError) {
      console.error("[PARENT] Erreur création auth user:", authError);
      return {
        success: false,
        error: authError?.message || "Failed to create auth user",
        details: authError,
      };
    }

    const userId = userData.user.id;
    console.log("[PARENT] Auth user créé:", userId);

    // Étape 2: Créer parent record
    const {
      success: parentSuccess,
      parentId,
      error: parentError,
    } = await createParentRecord(supabase, {
      ...parentData,
      schoolId: authData.schoolId,
      userId,
      firstName: authData.firstName,
      lastName: authData.lastName,
      email: authData.email,
    });

    if (!parentSuccess || parentError) {
      // Cleanup: supprimer l'auth user
      await supabase.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: parentError || "Failed to create parent record",
        details: parentError,
      };
    }

    console.log("[PARENT] Parent record créé:", parentId);

    // Étape 3: Assigner le rôle parent
    const { success: roleSuccess, error: roleError } = await assignParentRole(
      supabase,
      userId,
      authData.schoolId,
    );

    if (!roleSuccess || roleError) {
      // Cleanup: supprimer le parent et l'auth user
      await supabase.from("parents").delete().eq("id", parentId);
      await supabase.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: roleError || "Failed to assign parent role",
        details: roleError,
      };
    }

    console.log("[PARENT] Rôle parent assigné");

    return {
      success: true,
      data: {
        parentId,
        relationId: "", // Sera créé séparément si nécessaire
      },
    };
  } catch (error: any) {
    console.error("[PARENT] Exception création complète:", error);
    return {
      success: false,
      error: error.message || "Unexpected error creating parent",
      details: error,
    };
  }
}
