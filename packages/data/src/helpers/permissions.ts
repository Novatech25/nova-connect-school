import { getSupabaseClient } from "../client";
import { checkPremiumFeature } from "./premiumFeatures";

const supabase = getSupabaseClient();

/**
 * Check if current user is a super admin
 */
export async function checkSuperAdminAccess(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  return userData?.role === "super_admin";
}

/**
 * Check if current user can access a specific school
 * Super admins can access all schools, school admins can only access their own
 */
export async function checkSchoolAccess(schoolId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return false;
  }

  // Super admins can access all schools
  if (userData.role === "super_admin") {
    return true;
  }

  // School admins can only access their own school
  if (userData.role === "school_admin") {
    return userData.school_id === schoolId;
  }

  return false;
}

/**
 * Check if current user can manage licenses
 */
export async function canManageLicenses(): Promise<boolean> {
  return await checkSuperAdminAccess();
}

/**
 * Check if current user can manage support tickets
 */
export async function canManageTickets(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return false;
  }

  // Super admins can manage all tickets
  if (userData.role === "super_admin") {
    return true;
  }

  // School users can create/view tickets for their school
  return ["school_admin", "accountant", "teacher"].includes(userData.role);
}

/**
 * Check if current user can view audit logs
 */
export async function canViewAuditLogs(): Promise<boolean> {
  return await checkSuperAdminAccess();
}

/**
 * Get current user's school ID
 */
export async function getCurrentUserSchoolId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: userData } = await supabase
    .from("users")
    .select("school_id")
    .eq("id", user.id)
    .single();

  return userData?.school_id || null;
}

/**
 * Check if current user can create schools
 */
export async function canCreateSchools(): Promise<boolean> {
  return await checkSuperAdminAccess();
}

/**
 * Check if current user can edit schools
 */
export async function canEditSchools(schoolId?: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return false;
  }

  // Super admins can edit all schools
  if (userData.role === "super_admin") {
    return true;
  }

  // School admins can only edit their own school (limited fields)
  if (userData.role === "school_admin" && schoolId) {
    return userData.school_id === schoolId;
  }

  return false;
}

/**
 * Check if current user can access import feature
 * Requires school_admin or supervisor role + premium feature
 */
export async function canAccessImports(schoolId?: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return false;
  }

  // Only school admins and supervisors can access imports
  if (!["school_admin", "supervisor"].includes(userData.role)) {
    return false;
  }

  // Check school ID match (for school admins)
  const targetSchoolId = schoolId || userData.school_id;
  if (userData.role === "school_admin" && userData.school_id !== targetSchoolId) {
    return false;
  }

  // Check premium feature access
  return await checkPremiumFeature(targetSchoolId, "api_import");
}

/**
 * Check if current user can import students
 */
export async function canImportStudents(schoolId?: string): Promise<boolean> {
  return await canAccessImports(schoolId);
}

/**
 * Check if current user can import grades
 */
export async function canImportGrades(schoolId?: string): Promise<boolean> {
  return await canAccessImports(schoolId);
}

/**
 * Check if current user can import schedules
 */
export async function canImportSchedules(schoolId?: string): Promise<boolean> {
  return await canAccessImports(schoolId);
}

/**
 * Check if current user can manage import templates
 */
export async function canManageImportTemplates(schoolId?: string): Promise<boolean> {
  return await canAccessImports(schoolId);
}

/**
 * Check if current user can rollback imports
 */
export async function canRollbackImports(schoolId?: string): Promise<boolean> {
  return await canAccessImports(schoolId);
}
