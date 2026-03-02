import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Business logic functions (inline version for Edge Function)
function groupScheduleSlots(slots: any[], enrollmentCounts: Map<string, number>) {
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
        totalStudents: 0,
        slotIds: [],
      });
    }

    const group = groups.get(key);
    group.classIds.push(slot.class_id);
    group.slotIds.push(slot.id);

    // Use aggregated enrollment count
    const studentCount = enrollmentCounts.get(slot.class_id) || 0;
    group.totalStudents += studentCount;
  }

  return Array.from(groups.values());
}

function selectOptimalRoom(availableRooms: any[], requiredCapacity: number, config: any) {
  const marginMultiplier = 1 + (config.capacityMarginPercent / 100);
  const targetCapacity = Math.ceil(requiredCapacity * marginMultiplier);

  const roomsWithCapacity = availableRooms.filter((r: any) => r.capacity !== null && r.is_available);

  if (roomsWithCapacity.length === 0) {
    return { room: null, status: 'insufficient', marginPercent: null };
  }

  const sufficientRooms = roomsWithCapacity.filter((r: any) => r.capacity >= targetCapacity);

  if (sufficientRooms.length > 0) {
    let selectedRoom: any;

    if (config.selectionPriority === 'capacity') {
      selectedRoom = sufficientRooms.reduce((max: any, r: any) =>
        r.capacity > max.capacity ? r : max
      );
    } else {
      const categoryOrder = ['very_large', 'large', 'medium', 'small'];
      selectedRoom = sufficientRooms.sort((a: any, b: any) => {
        const aIndex = a.size_category ? categoryOrder.indexOf(a.size_category) : 999;
        const bIndex = b.size_category ? categoryOrder.indexOf(b.size_category) : 999;
        return aIndex - bIndex;
      })[0];
    }

    const marginPercent = ((selectedRoom.capacity - requiredCapacity) / requiredCapacity) * 100;
    const status = marginPercent >= config.capacityMarginPercent ? 'optimal' : 'sufficient';

    return { room: selectedRoom, status, marginPercent };
  }

  const largestRoom = roomsWithCapacity.reduce((max: any, r: any) =>
    r.capacity > max.capacity ? r : max
  );

  const marginPercent = ((largestRoom.capacity - requiredCapacity) / requiredCapacity) * 100;

  return { room: largestRoom, status: 'insufficient', marginPercent };
}

function isTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const [h1, m1] = start1.split(':').map(Number);
  const [h2, m2] = end1.split(':').map(Number);
  const [h3, m3] = start2.split(':').map(Number);
  const [h4, m4] = end2.split(':').map(Number);

  const start1Minutes = h1 * 60 + m1;
  const end1Minutes = h2 * 60 + m2;
  const start2Minutes = h3 * 60 + m3;
  const end2Minutes = h4 * 60 + m4;

  return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
}

interface CalculateRoomAssignmentsRequest {
  scheduleId?: string;
  sessionDate?: string;
  schoolId: string;
  autoPublish?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify origin for security
    const origin = req.headers.get('Origin');
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://novaconnect.vercel.app',  // Remplacez par votre domaine de production
      'https://www.novaconnect.vercel.app',
    ];
    
    // Allow requests from allowed origins or from same origin (no origin header)
    if (origin && !allowedOrigins.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Unauthorized origin' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body
    const { scheduleId, sessionDate, schoolId, autoPublish = false }: CalculateRoomAssignmentsRequest = await req.json();

    if (!schoolId) {
      return new Response(JSON.stringify({ error: 'schoolId is required' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get school configuration
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return new Response(JSON.stringify({ error: 'School not found' }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dynamicRoomConfig = school.settings?.dynamicRoomAssignment;

    if (!dynamicRoomConfig?.enabled) {
      return new Response(JSON.stringify({ error: 'Dynamic room assignment module is not enabled' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Determine the date to calculate for
    const targetDate = sessionDate || new Date().toISOString().split('T')[0];

    // Convert targetDate to day of week (0=Sunday, 1=Monday, etc.)
    const targetDateObj = new Date(targetDate);
    const dayOfWeek = targetDateObj.getDay(); // 0-6
    const dayOfWeekNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDayOfWeek = dayOfWeekNames[dayOfWeek];

    // 3. Get schedule slots for the specific date/day_of_week
    let slotsQuery = supabase
      .from('schedule_slots')
      .select('*')
      .eq('school_id', schoolId)
      .eq('day_of_week', targetDayOfWeek); // Comment 1: Filter by day_of_week

    if (scheduleId) {
      slotsQuery = slotsQuery.eq('schedule_id', scheduleId);
    }

    const { data: slots, error: slotsError } = await slotsQuery;

    if (slotsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch schedule slots' }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!slots || slots.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        assignmentsCreated: 0,
        assignmentsUpdated: 0,
        insufficientCapacity: [],
        message: 'No schedule slots found for the given criteria'
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Get class enrollments with COUNT aggregation (Comment 2)
    const classIds = [...new Set(slots.map(s => s.class_id))];

    // Use RPC to aggregate student counts per class
    const { data: enrollmentData, error: enrollmentsError } = await supabase
      .rpc('get_class_enrollment_counts', {
        p_class_ids: classIds
      });

    if (enrollmentsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch enrollments' }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert to Map for efficient lookup
    const enrollmentCounts = new Map<string, number>();
    if (enrollmentData) {
      for (const row of enrollmentData) {
        enrollmentCounts.set(row.class_id, row.student_count);
      }
    }

    // 5. Get available rooms
    const campusIds = [...new Set(slots.map(s => s.campus_id).filter(Boolean))];
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .in('campus_id', campusIds)
      .eq('is_available', true);

    if (roomsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch rooms' }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Group schedule slots
    const groupedSessions = groupScheduleSlots(slots, enrollmentCounts);

    let assignmentsCreated = 0;
    let assignmentsUpdated = 0;
    const insufficientCapacity: any[] = [];

    // 7. Process each group
    for (const group of groupedSessions) {
      // Get existing assignments for this date and time (Comment 3: add school_id filter)
      const { data: existingAssignments } = await supabase
        .from('room_assignments')
        .select('assigned_room_id, start_time, end_time')
        .eq('school_id', schoolId) // Comment 3: Filter by school_id
        .eq('session_date', targetDate);

      // Comment 6: Check for room reservations
      const { data: roomReservations } = await supabase
        .from('room_reservations')
        .select('room_id, start_time, end_time')
        .eq('school_id', schoolId)
        .eq('reservation_date', targetDate);

      // Filter available rooms for this campus
      const campusRooms = rooms.filter((r: any) =>
        !group.campusId || r.campus_id === group.campusId
      );

      // Exclude already booked rooms and reserved rooms (Comment 3 & 6)
      const availableRooms = campusRooms.filter((room: any) => {
        // Check room assignments
        const isAssigned = existingAssignments?.some((assignment: any) =>
          assignment.assigned_room_id === room.id &&
          isTimeOverlap(group.startTime, group.endTime, assignment.start_time, assignment.end_time)
        );

        // Check room reservations (Comment 6)
        const isReserved = roomReservations?.some((reservation: any) =>
          reservation.room_id === room.id &&
          isTimeOverlap(group.startTime, group.endTime, reservation.start_time, reservation.end_time)
        );

        return !isAssigned && !isReserved;
      });

      // Select optimal room
      const { room, status, marginPercent } = selectOptimalRoom(
        availableRooms,
        group.totalStudents,
        dynamicRoomConfig
      );

      if (!room) {
        insufficientCapacity.push({
          teacherId: group.teacherId,
          subjectId: group.subjectId,
          requiredCapacity: group.totalStudents,
          time: `${group.startTime} - ${group.endTime}`,
        });
        continue;
      }

      // Check if assignment already exists
      const { data: existingAssignment } = await supabase
        .from('room_assignments')
        .select('*')
        .eq('school_id', schoolId)
        .eq('session_date', targetDate)
        .eq('teacher_id', group.teacherId)
        .eq('subject_id', group.subjectId)
        .eq('start_time', group.startTime)
        .eq('end_time', group.endTime)
        .maybeSingle();

      const assignmentData = {
        school_id: schoolId,
        session_date: targetDate,
        teacher_id: group.teacherId,
        subject_id: group.subjectId,
        campus_id: group.campusId,
        start_time: group.startTime,
        end_time: group.endTime,
        grouped_class_ids: group.classIds,
        total_students: group.totalStudents,
        assigned_room_id: room.id,
        assignment_method: 'auto',
        capacity_status: status,
        capacity_margin_percent: marginPercent,
        status: autoPublish ? 'published' : 'draft',
        published_at: autoPublish ? new Date().toISOString() : null,
      };

      if (existingAssignment) {
        // Update existing assignment
        const { error: updateError } = await supabase
          .from('room_assignments')
          .update({
            ...assignmentData,
            version: existingAssignment.version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAssignment.id);

        if (!updateError) {
          assignmentsUpdated++;

          // Log event
          await supabase.from('room_assignment_events').insert({
            school_id: schoolId,
            room_assignment_id: existingAssignment.id,
            event_type: 'updated',
            old_room_id: existingAssignment.assigned_room_id,
            new_room_id: room.id,
            reason: 'Automatic recalculation',
            metadata: {
              previous_status: existingAssignment.status,
              new_status: status,
            },
          });
        }
      } else {
        // Create new assignment
        const { data: newAssignment, error: insertError } = await supabase
          .from('room_assignments')
          .insert({
            ...assignmentData,
            calculated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (!insertError && newAssignment) {
          assignmentsCreated++;

          // Log event
          await supabase.from('room_assignment_events').insert({
            school_id: schoolId,
            room_assignment_id: newAssignment.id,
            event_type: 'created',
            new_room_id: room.id,
            reason: 'Automatic calculation',
            metadata: {
              status,
              margin_percent: marginPercent,
            },
          });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      assignmentsCreated,
      assignmentsUpdated,
      insufficientCapacity,
      message: `Processed ${groupedSessions.length} groups: ${assignmentsCreated} created, ${assignmentsUpdated} updated`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error in calculate-room-assignments:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
