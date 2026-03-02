"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials for Server Actions");
}

// Admin client to bypass RLS
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export async function getStudentPaymentsSecure(studentId: string) {
  try {
    // Fetch payments with all details using admin privileges
    // We use !left join to ensure we get payments even if fee_schedule is null or restricted
    const { data, error } = await adminClient
      .from("payments")
      .select(`
        *,
        fee_schedule:fee_schedules!left(*, fee_type:fee_types(*))
      `)
      .eq("student_id", studentId)
      .order("payment_date", { ascending: false });

    if (error) {
        console.error("Admin payments fetch error:", error);
        return { data: [], error: error.message };
    }
    
    return { data, error: null };
  } catch (err: any) {
    console.error("Server Action Error:", err);
    return { data: [], error: err.message };
  }
}

export async function getStudentFeeSchedulesSecure(studentId: string, academicYearId?: string) {
    try {
        let query = adminClient
            .from("fee_schedules")
            .select(`
                *,
                fee_type:fee_types(*)
            `)
            .eq("student_id", studentId)
            .neq("status", "cancelled")
            .order("due_date");

        if (academicYearId) {
            query = query.eq("academic_year_id", academicYearId);
        }

        const { data, error } = await query;
        
        if (error) {
            console.error("Admin fees fetch error:", error);
            return { data: [], error: error.message };
        }

        return { data, error: null };
    } catch (err: any) {
        return { data: [], error: err.message };
    }
}

export async function getStudentProfileSecure(userId: string) {
  try {
    const { data, error } = await adminClient
      .from("students")
      .select(`
        *,
        school:schools(*),
        enrollments:enrollments(
            *,
            class:classes!enrollments_class_id_fkey(*),
            academic_year:academic_years(*)
        )
      `)
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Admin student profile fetch error:", error);
      return { data: null, error: error.message, code: error.code };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error("Server Action Error (getStudentProfileSecure):", err);
    return { data: null, error: err.message };
  }
}

export async function getStudentProfileByIdSecure(id: string) {
  try {
    const { data, error } = await adminClient
      .from("students")
      .select(`
        *,
        school:schools(*),
        enrollments:enrollments(
            *,
            class:classes!enrollments_class_id_fkey(*),
            academic_year:academic_years(*)
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Admin student profile by id fetch error:", error);
      return { data: null, error: error.message, code: error.code };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error("Server Action Error (getStudentProfileByIdSecure):", err);
    return { data: null, error: err.message };
  }
}

export async function getAcademicYearsSecure(schoolId: string) {
    try {
        const { data, error } = await adminClient
            .from("academic_years")
            .select("*")
            .eq("school_id", schoolId)
            .order("start_date", { ascending: false });

        if (error) {
            console.error("Admin academic years fetch error:", error);
            return { data: [], error: error.message };
        }
        return { data, error: null };
    } catch (err: any) {
        return { data: [], error: err.message };
    }
}
