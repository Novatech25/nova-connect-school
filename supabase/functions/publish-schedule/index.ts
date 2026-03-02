import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDays, format, parseISO, isBefore, isAfter, isEqual, startOfDay, getDay } from "https://esm.sh/date-fns@2.30.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PublishScheduleRequest {
  scheduleId: string;
  notifyUsers?: boolean;
}

interface ConstraintViolation {
  type: string;
  severity: "error" | "warning";
  message: string;
  affectedSlots: string[];
  metadata?: Record<string, unknown>;
}

interface PublishScheduleResponse {
  success: boolean;
  schedule?: any;
  sessionsCreated?: number;
  violations?: ConstraintViolation[];
  error?: string;
  stack?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token received:", token.substring(0, 30) + "...");

    // Decode JWT payload to get user ID (without verification - we trust the token from the client)
    let userId: string | null = null;
    try {
      const base64Payload = token.split('.')[1];
      const payload = JSON.parse(atob(base64Payload));
      userId = payload.sub;
      console.log("User ID from token:", userId);
    } catch (e) {
      console.error("Failed to decode token:", e);
      return new Response(JSON.stringify({ 
        error: "Invalid token format",
        details: String(e)
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ 
        error: "Invalid authentication", 
        details: "No user ID in token" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client for DB operations
    // IMPORTANT: Service role key bypasses RLS automatically
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 2. Parse request
    const { scheduleId, notifyUsers = false }: PublishScheduleRequest = await req.json();

    if (!scheduleId) {
      return new Response(
        JSON.stringify({ error: "Missing schedule_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get schedule data
    const { data: schedule, error: scheduleError } = await supabase
      .from("schedules")
      .select(`*, academic_year:academic_years(*)`)
      .eq("id", scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return new Response(JSON.stringify({ error: "Schedule not found", details: scheduleError?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle academic_year join response (can be array or object)
    let academicYear = schedule.academic_year;
    if (Array.isArray(academicYear)) {
      academicYear = academicYear[0];
    }

    if (!academicYear && schedule.academic_year_id) {
      const { data: ay } = await supabase
        .from('academic_years')
        .select('*')
        .eq('id', schedule.academic_year_id)
        .single();
      academicYear = ay;
    }

    if (!academicYear) {
      return new Response(JSON.stringify({ error: "Academic year not found for this schedule" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Get slots
    const { data: slots, error: slotsError } = await supabase
      .from("schedule_slots")
      .select("*")
      .eq("schedule_id", scheduleId);

    if (slotsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch schedule slots", details: slotsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!slots || slots.length === 0) {
      return new Response(
        JSON.stringify({ error: "Cannot publish empty schedule" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Update Schedule Status & Versioning using RPC (bypasses RLS)
    console.log("Calling publish_schedule_bypass_rls RPC...");
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('publish_schedule_bypass_rls', {
      p_schedule_id: scheduleId,
      p_user_id: userId,
      p_notify_users: notifyUsers
    });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to publish schedule via RPC", 
          details: rpcError.message 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rpcResult || !rpcResult.success) {
      console.error("RPC returned failure:", rpcResult);
      return new Response(
        JSON.stringify({ 
          error: rpcResult?.error || "Publication failed", 
          details: rpcResult 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("RPC success:", rpcResult);
    
    const updatedSchedule = rpcResult.schedule;
    const newVersion = rpcResult.version;

    // 6. Generate Sessions Logic
    const academicStart = parseISO(academicYear.start_date);
    const academicEnd = parseISO(academicYear.end_date);
    const today = startOfDay(new Date());

    // Determine generation start date
    let generationStart = academicStart;
    if (schedule.status === 'published') {
      const tomorrow = addDays(today, 1);
      generationStart = isAfter(tomorrow, academicStart) ? tomorrow : academicStart;
    }

    // Cleanup existing future sessions
    const slotIds = slots.map((s: any) => s.id);
    if (slotIds.length > 0) {
      await supabase
        .from('planned_sessions')
        .delete()
        .in('schedule_slot_id', slotIds)
        .gte('session_date', generationStart.toISOString())
        .eq('is_completed', false);
    }

    // Generate new sessions
    const sessionsToInsert: any[] = [];
    let sessionsCount = 0;
    let currentDate = generationStart;
    const MAX_DAYS = 400;
    let safetyCounter = 0;

    while ((isBefore(currentDate, academicEnd) || isEqual(currentDate, academicEnd)) && safetyCounter < MAX_DAYS) {
      const dayName = getDayName(currentDate);
      const daySlots = slots.filter((s: any) => s.day_of_week === dayName);

      for (const slot of daySlots) {
        let shouldCreate = false;
        if (!slot.is_recurring) {
          const firstOccurrence = getNextDayOfWeek(academicStart, slot.day_of_week);
          if (isEqual(currentDate, firstOccurrence)) {
            shouldCreate = true;
          }
        } else {
          const recurEnd = slot.recurrence_end_date ? parseISO(slot.recurrence_end_date) : academicEnd;
          if (isBefore(currentDate, recurEnd) || isEqual(currentDate, recurEnd)) {
            shouldCreate = true;
          }
        }

        if (shouldCreate) {
          sessionsToInsert.push({
            school_id: schedule.school_id,
            schedule_slot_id: slot.id,
            teacher_id: slot.teacher_id,
            class_id: slot.class_id,
            subject_id: slot.subject_id,
            room_id: slot.room_id,
            session_date: format(currentDate, 'yyyy-MM-dd'),
            start_time: slot.start_time,
            end_time: slot.end_time,
            duration_minutes: calculateDuration(slot.start_time, slot.end_time),
            is_completed: false,
            is_cancelled: false
          });
        }
      }

      currentDate = addDays(currentDate, 1);
      safetyCounter++;
    }

    // Bulk insert in batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < sessionsToInsert.length; i += BATCH_SIZE) {
      const batch = sessionsToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('planned_sessions')
        .insert(batch);

      if (insertError) {
        console.error("Batch insert error:", insertError);
        throw new Error(`Failed to insert sessions: ${insertError.message}`);
      }
      sessionsCount += batch.length;
    }

    // 7. Audit Log (uses current audit_logs schema: entity_type, entity_id, action, table_name, description)
    await supabase.from("audit_logs").insert({
      school_id: schedule.school_id,
      user_id: userId,
      entity_type: "schedule",
      entity_id: scheduleId,
      action: "publish",
      table_name: "schedules",
      description: `Published schedule: ${schedule.name} (version ${newVersion}, sessions: ${sessionsCount})`,
    });

    // 8. Notifications (async, don't wait)
    if (notifyUsers) {
      sendNotifications(supabase, schedule, slots, authHeader).catch(console.error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        schedule: updatedSchedule,
        sessionsCreated: sessionsCount
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Publish schedule error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Helpers ---

function getDayName(date: Date): string {
  const day = getDay(date);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[day];
}

function getNextDayOfWeek(date: Date, targetDay: string): Date {
  const targetDayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(targetDay);
  const currentDayIndex = getDay(date);
  let daysToAdd = targetDayIndex - currentDayIndex;
  if (daysToAdd < 0) daysToAdd += 7;
  return addDays(date, daysToAdd);
}

function calculateDuration(start: string, end: string): number {
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

async function sendNotifications(supabase: any, schedule: any, slots: any[], authHeader: string) {
  try {
    const isRepublish = (schedule.version || 0) > 1;
    const actionLabel = isRepublish ? 'mis à jour' : 'publié';
    console.log(`📧 Sending notifications for schedule: ${schedule.name} (${actionLabel})`);

    // 1. Get teachers
    const teacherIds = [...new Set(slots.map((s: any) => s.teacher_id).filter(Boolean))];
    console.log(`👨‍🏫 Teachers: ${teacherIds.length}`);

    // 2. Get classes
    const classIds = [...new Set(slots.map((s: any) => s.class_id).filter(Boolean))];
    console.log(`🎓 Classes: ${classIds.length}`);

    // 3. Get students
    let studentUserIds: string[] = [];
    if (classIds.length > 0) {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id, students!inner(user_id)')
        .in('class_id', classIds)
        .in('status', ['enrolled', 'pending']);

      studentUserIds = [...new Set(
        (enrollments || [])
          .map((e: any) => e.students?.user_id)
          .filter(Boolean)
      )] as string[];
    }
    console.log(`👨‍🎓 Students: ${studentUserIds.length}`);

    // 4. Get parents
    let parentUserIds: string[] = [];
    if (classIds.length > 0) {
      const { data: enrolledStudents } = await supabase
        .from('enrollments')
        .select('student_id')
        .in('class_id', classIds)
        .in('status', ['enrolled', 'pending']);

      const studentIds = [...new Set((enrolledStudents || []).map((e: any) => e.student_id).filter(Boolean))];

      if (studentIds.length > 0) {
        const { data: parentRelations } = await supabase
          .from('student_parent_relations')
          .select('parent_id, parents!inner(user_id)')
          .in('student_id', studentIds);

        parentUserIds = [...new Set(
          (parentRelations || [])
            .map((r: any) => r.parents?.user_id)
            .filter(Boolean)
        )] as string[];
      }
    }
    console.log(`👪 Parents: ${parentUserIds.length}`);

    // 5. Create notifications
    const notifications: any[] = [];

    for (const teacherId of teacherIds) {
      notifications.push({
        user_id: teacherId,
        school_id: schedule.school_id,
        type: 'schedule_published',
        title: isRepublish ? 'Emploi du temps mis à jour' : 'Nouvel emploi du temps publié',
        message: `L'emploi du temps "${schedule.name}" a été ${actionLabel}.`,
        data: { link: '/teacher/schedule', schedule_id: schedule.id },
      });
    }

    for (const studentUserId of studentUserIds) {
      notifications.push({
        user_id: studentUserId,
        school_id: schedule.school_id,
        type: 'schedule_published',
        title: isRepublish ? 'Emploi du temps mis à jour' : 'Nouvel emploi du temps disponible',
        message: `L'emploi du temps "${schedule.name}" est ${isRepublish ? 'mis à jour' : 'disponible'}.`,
        data: { link: '/student/schedule', schedule_id: schedule.id },
      });
    }

    for (const parentUserId of parentUserIds) {
      notifications.push({
        user_id: parentUserId,
        school_id: schedule.school_id,
        type: 'schedule_published',
        title: isRepublish ? "Emploi du temps mis à jour" : "Emploi du temps de votre enfant",
        message: `L'emploi du temps "${schedule.name}" a été ${actionLabel}.`,
        data: { link: '/parent/children', schedule_id: schedule.id },
      });
    }

    // Insert notifications
    if (notifications.length > 0) {
      const BATCH_SIZE = 200;
      for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
        const batch = notifications.slice(i, i + BATCH_SIZE);
        const { error: notifError } = await supabase.from('notifications').insert(batch);
        if (notifError) console.error('Error inserting notifications:', notifError);
      }
      console.log(`✅ ${notifications.length} notifications créées`);
    }

  } catch (error) {
    console.error('Error in sendNotifications:', error);
  }
}
