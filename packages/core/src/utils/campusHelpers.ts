// Campus Business Helpers
// Multi-campus management utilities and business logic

import { calculateDistance, isWithinRadius } from './geolocation';

// ============================================================================
// CAMPUS LOCATION VALIDATION
// ============================================================================

/**
 * Validate user location within campus boundaries
 * @param supabase - Supabase client
 * @param campusId - Campus ID to validate against
 * @param userLat - User's latitude
 * @param userLon - User's longitude
 * @returns Validation result with campus info and distance
 */
export async function validateCampusLocation(
  supabase: any,
  campusId: string,
  userLat: number,
  userLon: number
): Promise<{
  valid: boolean;
  distance: number;
  campus: any;
}> {
  // Fetch campus details
  const { data: campus, error } = await supabase
    .from('campuses')
    .select('*')
    .eq('id', campusId)
    .single();

  if (error || !campus) {
    throw new Error('Campus not found');
  }

  // If campus doesn't have GPS configured, allow access
  if (!campus.latitude || !campus.longitude) {
    return {
      valid: true,
      distance: 0,
      campus,
    };
  }

  // Calculate distance from user to campus
  const distance = calculateDistance(
    userLat,
    userLon,
    campus.latitude,
    campus.longitude
  );

  // Check if within radius
  const valid = isWithinRadius(
    userLat,
    userLon,
    campus.latitude,
    campus.longitude,
    campus.radius_meters
  );

  return {
    valid,
    distance,
    campus,
  };
}

// ============================================================================
// USER CAMPUS ACCESS
// ============================================================================

/**
 * Get list of campus IDs a user has access to
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param schoolId - School ID
 * @returns Array of accessible campus IDs
 */
export async function getUserCampusAccess(
  supabase: any,
  userId: string,
  schoolId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_campus_access')
    .select('campus_id')
    .eq('user_id', userId)
    .eq('school_id', schoolId)
    .eq('can_access', true);

  if (error) {
    console.error('Error fetching user campus access:', error);
    return [];
  }

  return data.map((access: any) => access.campus_id);
}

/**
 * Check if user has access to a specific campus
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param campusId - Campus ID
 * @returns true if user has access
 */
export async function hasUserCampusAccess(
  supabase: any,
  userId: string,
  campusId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_user_campus_access', {
      p_user_id: userId,
      p_campus_id: campusId,
    });

    if (error) {
      console.error('Error checking user campus access:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking user campus access:', error);
    return false;
  }
}

/**
 * Grant user access to a campus
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param campusId - Campus ID
 * @param schoolId - School ID
 * @param accessType - Type of access (full_access, restricted, read_only)
 * @returns Created access record
 */
export async function grantUserCampusAccess(
  supabase: any,
  userId: string,
  campusId: string,
  schoolId: string,
  accessType: 'full_access' | 'restricted' | 'read_only' = 'full_access'
): Promise<any> {
  const { data, error } = await supabase
    .from('user_campus_access')
    .insert({
      user_id: userId,
      campus_id: campusId,
      school_id: schoolId,
      access_type: accessType,
      can_access: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to grant campus access: ${error.message}`);
  }

  return data;
}

/**
 * Revoke user access to a campus
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param campusId - Campus ID
 * @returns true if successful
 */
export async function revokeUserCampusAccess(
  supabase: any,
  userId: string,
  campusId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_campus_access')
    .delete()
    .eq('user_id', userId)
    .eq('campus_id', campusId);

  if (error) {
    console.error('Error revoking campus access:', error);
    return false;
  }

  return true;
}

/**
 * Update user campus access type
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param campusId - Campus ID
 * @param accessType - New access type
 * @returns Updated access record
 */
export async function updateUserCampusAccess(
  supabase: any,
  userId: string,
  campusId: string,
  accessType: 'full_access' | 'restricted' | 'read_only'
): Promise<any> {
  const { data, error } = await supabase
    .from('user_campus_access')
    .update({
      access_type: accessType,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('campus_id', campusId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update campus access: ${error.message}`);
  }

  return data;
}

// ============================================================================
// CLASS CAMPUS ASSIGNMENT
// ============================================================================

/**
 * Get the campus assigned to a class
 * @param supabase - Supabase client
 * @param classId - Class ID
 * @returns Campus ID or null
 */
export async function getClassCampus(
  supabase: any,
  classId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('classes')
    .select('campus_id')
    .eq('id', classId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.campus_id;
}

/**
 * Assign a class to a campus
 * @param supabase - Supabase client
 * @param classId - Class ID
 * @param campusId - Campus ID (null to unassign)
 * @returns Updated class record
 */
export async function assignClassToCampus(
  supabase: any,
  classId: string,
  campusId: string | null
): Promise<any> {
  const { data, error } = await supabase
    .from('classes')
    .update({
      campus_id: campusId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', classId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to assign class to campus: ${error.message}`);
  }

  return data;
}

/**
 * Get all classes assigned to a campus
 * @param supabase - Supabase client
 * @param campusId - Campus ID
 * @returns Array of classes
 */
export async function getCampusClasses(
  supabase: any,
  campusId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('campus_id', campusId);

  if (error) {
    console.error('Error fetching campus classes:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// DATA FILTERING BY CAMPUS
// ============================================================================

/**
 * Filter items by user's campus access
 * @param items - Array of items with optional campus_id
 * @param allowedCampusIds - Array of campus IDs the user can access
 * @returns Filtered array
 */
export function filterByCampusAccess<T extends { campus_id?: string | null }>(
  items: T[],
  allowedCampusIds: string[]
): T[] {
  return items.filter(
    (item) => !item.campus_id || allowedCampusIds.includes(item.campus_id)
  );
}

/**
 * Group items by campus
 * @param items - Array of items with campus_id
 * @returns Object with campus IDs as keys and arrays of items as values
 */
export function groupByCampus<T extends { campus_id?: string | null }>(
  items: T[]
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  for (const item of items) {
    const campusId = item.campus_id || 'none';
    if (!grouped[campusId]) {
      grouped[campusId] = [];
    }
    grouped[campusId].push(item);
  }

  return grouped;
}

/**
 * Filter sessions by campus
 * @param supabase - Supabase client
 * @param campusId - Campus ID
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Array of sessions
 */
export async function getCampusSessions(
  supabase: any,
  campusId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const { data, error } = await supabase
    .from('planned_sessions')
    .select(
      `
      *,
      teacher:users!teacher_id(first_name, last_name),
      class:classes(name),
      subject:subjects(name),
      room:rooms(name)
    `
    )
    .eq('campus_id', campusId)
    .gte('session_date', startDate.toISOString().split('T')[0])
    .lte('session_date', endDate.toISOString().split('T')[0])
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching campus sessions:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// CAMPUS STATISTICS
// ============================================================================

/**
 * Get campus statistics
 * @param supabase - Supabase client
 * @param campusId - Campus ID
 * @returns Campus statistics
 */
export async function getCampusStatistics(
  supabase: any,
  campusId: string
): Promise<{
  classes: number;
  students: number;
  teachers: number;
  rooms: number;
}> {
  // Get class count
  const { count: classCount } = await supabase
    .from('classes')
    .select('*', { count: 'exact', head: true })
    .eq('campus_id', campusId);

  // Get room count from campus_rooms
  const { count: roomCount } = await supabase
    .from('campus_rooms')
    .select('*', { count: 'exact', head: true })
    .eq('campus_id', campusId)
    .eq('is_active', true);

  // Get unique student count through enrollments
  // First, fetch all class IDs for this campus
  const { data: campusClasses } = await supabase
    .from('classes')
    .select('id')
    .eq('campus_id', campusId);

  const classIds = campusClasses?.map((c: any) => c.id) || [];

  // Then fetch enrollments for those classes
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student_id')
    .in('class_id', classIds);

  const uniqueStudents = new Set(enrollments?.map((e: any) => e.student_id) || []);

  // Get teacher count through user_campus_access
  const { count: teacherCount } = await supabase
    .from('user_campus_access')
    .select('*', { count: 'exact', head: true })
    .eq('campus_id', campusId)
    .eq('access_type', 'full_access');

  return {
    classes: classCount || 0,
    students: uniqueStudents.size,
    teachers: teacherCount || 0,
    rooms: roomCount || 0,
  };
}

// ============================================================================
// CAMPUS VALIDATION
// ============================================================================

/**
 * Validate that a room belongs to a campus
 * @param supabase - Supabase client
 * @param roomId - Room ID
 * @param campusId - Expected campus ID
 * @returns true if room belongs to campus
 */
export async function validateRoomCampus(
  supabase: any,
  roomId: string,
  campusId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_room_campus_access', {
      p_room_id: roomId,
      p_campus_id: campusId,
    });

    if (error) {
      console.error('Error checking room campus access:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking room campus access:', error);
    return false;
  }
}

/**
 * Get all rooms for a campus
 * @param supabase - Supabase client
 * @param campusId - Campus ID
 * @returns Array of rooms assigned to the campus
 */
export async function getCampusRooms(
  supabase: any,
  campusId: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('get_campus_rooms', {
      p_campus_id: campusId,
    });

    if (error) {
      console.error('Error fetching campus rooms:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching campus rooms:', error);
    return [];
  }
}

/**
 * Validate that a teacher has access to teach at a campus
 * @param supabase - Supabase client
 * @param teacherId - Teacher user ID
 * @param campusId - Campus ID
 * @returns true if teacher can teach at campus
 */
export async function validateTeacherCampusAccess(
  supabase: any,
  teacherId: string,
  campusId: string
): Promise<boolean> {
  return hasUserCampusAccess(supabase, teacherId, campusId);
}

/**
 * Validate schedule constraints for campus
 * @param supabase - Supabase client
 * @param sessionId - Session ID
 * @param campusId - Campus ID
 * @returns Validation result with errors if any
 */
export async function validateSessionCampusConstraints(
  supabase: any,
  sessionId: string,
  campusId: string
): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Get session details
  const { data: session, error: sessionError } = await supabase
    .from('planned_sessions')
    .select('*, class:classes(campus_id), room_id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return {
      valid: false,
      errors: ['Session not found'],
    };
  }

  // Validate class campus
  if (session.class?.campus_id && session.class.campus_id !== campusId) {
    errors.push('Class is not assigned to this campus');
  }

  // Validate room campus using campus_rooms table
  if (session.room_id) {
    const roomValid = await validateRoomCampus(supabase, session.room_id, campusId);
    if (!roomValid) {
      errors.push('Room is not assigned to this campus');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
