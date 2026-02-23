/**
 * Gateway LAN Sync for Room Assignments
 * Synchronizes room assignments between local SQLite and Supabase Cloud
 */

import { db } from '../db';
import { supabase } from '../supabase';

interface RoomAssignment {
  id: string;
  school_id: string;
  session_date: string;
  schedule_slot_id: string | null;
  teacher_id: string;
  subject_id: string;
  campus_id: string | null;
  start_time: string;
  end_time: string;
  grouped_class_ids: string; // JSON array string
  total_students: number;
  assigned_room_id: string | null;
  assignment_method: string;
  capacity_status: string | null;
  capacity_margin_percent: number | null;
  status: string;
  version: number;
  notified_at: string | null;
  notification_sent: number;
  calculated_by: string | null;
  calculated_at: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

/**
 * Sync room assignments from local database to Supabase Cloud
 */
export async function syncRoomAssignmentsToCloud(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Get unsynced assignments
    const unsyncedAssignments = await db.getAll(
      'SELECT * FROM room_assignments WHERE synced_at IS NULL'
    );

    for (const assignment of unsyncedAssignments) {
      try {
        const { error } = await supabase
          .from('room_assignments')
          .upsert({
            id: assignment.id,
            school_id: assignment.school_id,
            session_date: assignment.session_date,
            schedule_slot_id: assignment.schedule_slot_id,
            teacher_id: assignment.teacher_id,
            subject_id: assignment.subject_id,
            campus_id: assignment.campus_id,
            start_time: assignment.start_time,
            end_time: assignment.end_time,
            grouped_class_ids: JSON.parse(assignment.grouped_class_ids),
            total_students: assignment.total_students,
            assigned_room_id: assignment.assigned_room_id,
            assignment_method: assignment.assignment_method,
            capacity_status: assignment.capacity_status,
            capacity_margin_percent: assignment.capacity_margin_percent,
            status: assignment.status,
            version: assignment.version,
            notified_at: assignment.notified_at,
            notification_sent: assignment.notification_sent === 1,
            calculated_by: assignment.calculated_by,
            calculated_at: assignment.calculated_at,
            published_at: assignment.published_at,
            created_at: assignment.created_at,
            updated_at: assignment.updated_at,
          });

        if (error) throw error;

        // Mark as synced
        await db.run(
          'UPDATE room_assignments SET synced_at = datetime("now") WHERE id = ?',
          [assignment.id]
        );

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Assignment ${assignment.id}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`Sync failed: ${error.message}`);
  }

  return results;
}

/**
 * Sync room assignments from Supabase Cloud to local database
 */
export async function syncRoomAssignmentsFromCloud(
  schoolId: string,
  since?: Date
): Promise<number> {
  let syncedCount = 0;

  try {
    let query = supabase
      .from('room_assignments')
      .select('*')
      .eq('school_id', schoolId)
      .order('updated_at', { ascending: false });

    if (since) {
      query = query.gt('updated_at', since.toISOString());
    }

    const { data: assignments, error } = await query;

    if (error) throw error;
    if (!assignments) return 0;

    for (const assignment of assignments) {
      await db.run(
        `INSERT OR REPLACE INTO room_assignments (
          id, school_id, session_date, schedule_slot_id, teacher_id, subject_id,
          campus_id, start_time, end_time, grouped_class_ids, total_students,
          assigned_room_id, assignment_method, capacity_status, capacity_margin_percent,
          status, version, notified_at, notification_sent, calculated_by, calculated_at,
          published_at, created_at, updated_at, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))`,
        [
          assignment.id,
          assignment.school_id,
          assignment.session_date,
          assignment.schedule_slot_id,
          assignment.teacher_id,
          assignment.subject_id,
          assignment.campus_id,
          assignment.start_time,
          assignment.end_time,
          JSON.stringify(assignment.grouped_class_ids),
          assignment.total_students,
          assignment.assigned_room_id,
          assignment.assignment_method,
          assignment.capacity_status,
          assignment.capacity_margin_percent,
          assignment.status,
          assignment.version,
          assignment.notified_at,
          assignment.notification_sent ? 1 : 0,
          assignment.calculated_by,
          assignment.calculated_at,
          assignment.published_at,
          assignment.created_at,
          assignment.updated_at,
        ]
      );

      syncedCount++;
    }
  } catch (error) {
    console.error('Error syncing from cloud:', error);
    throw error;
  }

  return syncedCount;
}

/**
 * Calculate room assignments offline (for Gateway LAN mode)
 */
export async function calculateRoomAssignmentsOffline(
  schoolId: string,
  sessionDate: string
): Promise<number> {
  try {
    // Comment 1: Convert sessionDate to day_of_week
    const sessionDateObj = new Date(sessionDate);
    const dayOfWeek = sessionDateObj.getDay(); // 0-6
    const dayOfWeekNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDayOfWeek = dayOfWeekNames[dayOfWeek];

    // Get schedule slots from local DB filtered by day_of_week
    const slots = await db.getAll(
      `SELECT ss.* FROM schedule_slots ss
       JOIN schedules s ON ss.schedule_id = s.id
       WHERE s.school_id = ? AND s.is_published = 1 AND ss.day_of_week = ?`,
      [schoolId, targetDayOfWeek]
    );

    // Get enrollments
    const enrollments = await db.getAll(
      'SELECT class_id, COUNT(*) as student_count FROM class_enrollments GROUP BY class_id'
    );

    // Get rooms
    const rooms = await db.getAll(
      `SELECT r.* FROM rooms r
       JOIN campuses c ON r.campus_id = c.id
       WHERE c.school_id = ? AND r.is_available = 1`,
      [schoolId]
    );

    // Group schedule slots
    const groups = groupSlotsByMetadata(slots);

    let createdCount = 0;

    for (const group of groups) {
      // Calculate total students
      const totalStudents = enrollments
        .filter((e: any) => group.classIds.includes(e.class_id))
        .reduce((sum: number, e: any) => sum + e.student_count, 0);

      // Select optimal room
      const selectedRoom = selectRoomOffline(rooms, totalStudents, group.campusId);

      // Create assignment
      const assignmentId = generateUUID();
      await db.run(
        `INSERT INTO room_assignments (
          id, school_id, session_date, teacher_id, subject_id, campus_id,
          start_time, end_time, grouped_class_ids, total_students, assigned_room_id,
          assignment_method, capacity_status, status, version, notification_sent,
          calculated_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"), datetime("now"))`,
        [
          assignmentId,
          schoolId,
          sessionDate,
          group.teacherId,
          group.subjectId,
          group.campusId,
          group.startTime,
          group.endTime,
          JSON.stringify(group.classIds),
          totalStudents,
          selectedRoom?.id || null,
          selectedRoom ? 'auto' : 'fallback',
          selectedRoom ? 'sufficient' : 'insufficient',
          'draft',
          1,
          0,
        ]
      );

      createdCount++;
    }

    return createdCount;
  } catch (error) {
    console.error('Error calculating offline:', error);
    throw error;
  }
}

/**
 * Group schedule slots by teacher, subject, campus, time
 */
function groupSlotsByMetadata(slots: any[]): any[] {
  const groups = new Map();

  for (const slot of slots) {
    const key = `${slot.teacher_id}_${slot.subject_id}_${slot.campus_id || 'null'}_${slot.start_time}_${slot.end_time}`;

    if (!groups.has(key)) {
      groups.set(key, {
        teacherId: slot.teacher_id,
        subjectId: slot.subject_id,
        campusId: slot.campus_id,
        startTime: slot.start_time,
        endTime: slot.end_time,
        classIds: [],
        slotIds: [],
      });
    }

    const group = groups.get(key);
    group.classIds.push(slot.class_id);
    group.slotIds.push(slot.id);
  }

  return Array.from(groups.values());
}

/**
 * Select optimal room offline (simplified logic)
 */
function selectRoomOffline(rooms: any[], requiredCapacity: number, campusId: string | null) {
  const targetCapacity = Math.ceil(requiredCapacity * 1.1); // 10% margin

  // Filter by campus
  const campusRooms = campusId
    ? rooms.filter((r: any) => r.campus_id === campusId)
    : rooms;

  // Find rooms with sufficient capacity
  const sufficientRooms = campusRooms.filter((r: any) => r.capacity >= targetCapacity);

  if (sufficientRooms.length > 0) {
    // Return the largest sufficient room
    return sufficientRooms.reduce((max, r) => (r.capacity > max.capacity ? r : max));
  }

  // Fallback: return largest available
  return campusRooms.reduce((max, r) => (r.capacity > max.capacity ? r : max), null);
}

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
