import type {
  ScheduleSlot,
  Schedule,
  DayOfWeek,
} from "../schemas/schedule";

// ============================================
// TIME FORMATTING
// ============================================

/**
 * Formats a time slot for display
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @returns Formatted string like "08:00 - 09:30"
 */
export function formatTimeSlot(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

/**
 * Converts time in HH:MM format to minutes since midnight
 * @param time - Time in HH:MM format
 * @returns Minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Converts minutes since midnight to HH:MM format
 * @param minutes - Minutes since midnight
 * @returns Time in HH:MM format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// ============================================
// DAY LABELS
// ============================================

const dayLabels: Record<DayOfWeek, Record<string, string>> = {
  monday: { en: "Monday", fr: "Lundi" },
  tuesday: { en: "Tuesday", fr: "Mardi" },
  wednesday: { en: "Wednesday", fr: "Mercredi" },
  thursday: { en: "Thursday", fr: "Jeudi" },
  friday: { en: "Friday", fr: "Vendredi" },
  saturday: { en: "Saturday", fr: "Samedi" },
  sunday: { en: "Sunday", fr: "Dimanche" },
};

/**
 * Gets the localized label for a day of week
 * @param dayOfWeek - Day of week enum value
 * @param locale - Locale code (default: "en")
 * @returns Localized day label
 */
export function getDayLabel(dayOfWeek: DayOfWeek, locale: string = "en"): string {
  const labels = dayLabels[dayOfWeek];
  if (!labels) return dayOfWeek;
  return labels[locale as keyof typeof labels] || labels.en || dayOfWeek;
}

// ============================================
// GROUPING FUNCTIONS
// ============================================

/**
 * Groups schedule slots by day of week
 * @param slots - Array of schedule slots
 * @returns Record mapping day of week to slots
 */
export function groupSlotsByDay(slots: ScheduleSlot[]): Record<DayOfWeek, ScheduleSlot[]> {
  const grouped = {} as Record<DayOfWeek, ScheduleSlot[]>;

  for (const slot of slots) {
    if (!grouped[slot.dayOfWeek]) {
      grouped[slot.dayOfWeek] = [];
    }
    grouped[slot.dayOfWeek].push(slot);
  }

  // Sort slots within each day by start time
  for (const day in grouped) {
    grouped[day as DayOfWeek].sort((a, b) =>
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );
  }

  return grouped;
}

/**
 * Groups schedule slots by teacher
 * @param slots - Array of schedule slots
 * @returns Record mapping teacher ID to slots
 */
export function groupSlotsByTeacher(slots: ScheduleSlot[]): Record<string, ScheduleSlot[]> {
  const grouped = {} as Record<string, ScheduleSlot[]>;

  for (const slot of slots) {
    if (!grouped[slot.teacherId]) {
      grouped[slot.teacherId] = [];
    }
    grouped[slot.teacherId]!.push(slot);
  }

  // Sort slots by day and time
  for (const slots of Object.values(grouped)) {
    slots.sort((a, b) => {
      const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const dayDiff = dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
  }

  return grouped;
}

/**
 * Groups schedule slots by class
 * @param slots - Array of schedule slots
 * @returns Record mapping class ID to slots
 */
export function groupSlotsByClass(slots: ScheduleSlot[]): Record<string, ScheduleSlot[]> {
  const grouped = {} as Record<string, ScheduleSlot[]>;

  for (const slot of slots) {
    if (!grouped[slot.classId]) {
      grouped[slot.classId] = [];
    }
    grouped[slot.classId]!.push(slot);
  }

  // Sort slots by day and time
  for (const slots of Object.values(grouped)) {
    slots.sort((a, b) => {
      const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const dayDiff = dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
  }

  return grouped;
}

/**
 * Groups schedule slots by room
 * @param slots - Array of schedule slots
 * @returns Record mapping room ID to slots
 */
export function groupSlotsByRoom(slots: ScheduleSlot[]): Record<string, ScheduleSlot[]> {
  const grouped = {} as Record<string, ScheduleSlot[]>;

  for (const slot of slots) {
    if (!slot.roomId) continue;
    if (!grouped[slot.roomId]) {
      grouped[slot.roomId] = [];
    }
    grouped[slot.roomId]!.push(slot);
  }

  // Sort slots by day and time
  for (const slots of Object.values(grouped)) {
    slots.sort((a, b) => {
      const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const dayDiff = dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
  }

  return grouped;
}

// ============================================
// CALCULATION FUNCTIONS
// ============================================

/**
 * Calculates the total weekly hours for a teacher
 * @param teacherId - Teacher ID
 * @param slots - Array of schedule slots
 * @returns Total hours per week
 */
export function calculateTeacherWeeklyHours(teacherId: string, slots: ScheduleSlot[]): number {
  let totalMinutes = 0;

  for (const slot of slots) {
    if (slot.teacherId === teacherId) {
      totalMinutes += timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
    }
  }

  return totalMinutes / 60;
}

/**
 * Calculates the total weekly hours for a class
 * @param classId - Class ID
 * @param slots - Array of schedule slots
 * @returns Total hours per week
 */
export function calculateClassWeeklyHours(classId: string, slots: ScheduleSlot[]): number {
  let totalMinutes = 0;

  for (const slot of slots) {
    if (slot.classId === classId) {
      totalMinutes += timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
    }
  }

  return totalMinutes / 60;
}

/**
 * Calculates statistics for a schedule
 * @param schedule - Schedule object
 * @param slots - Array of schedule slots
 * @returns Statistics object
 */
export function getScheduleStats(_schedule: Schedule, slots: ScheduleSlot[]) {
  const teacherIds = new Set(slots.map((s) => s.teacherId));
  const classIds = new Set(slots.map((s) => s.classId));
  const roomIds = new Set(slots.map((s) => s.roomId).filter((r) => r !== null && r !== undefined));
  const subjectIds = new Set(slots.map((s) => s.subjectId));

  let totalMinutes = 0;
  for (const slot of slots) {
    totalMinutes += timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
  }

  return {
    totalSlots: slots.length,
    totalTeachers: teacherIds.size,
    totalClasses: classIds.size,
    totalRooms: roomIds.size,
    totalSubjects: subjectIds.size,
    totalWeeklyHours: totalMinutes / 60,
    averageSlotDuration: slots.length > 0 ? totalMinutes / slots.length : 0,
  };
}

// ============================================
// DATE GENERATION
// ============================================

/**
 * Generates all recurrence dates for a given day of week within a date range
 * @param startDate - Start date
 * @param endDate - End date
 * @param dayOfWeek - Day of week
 * @returns Array of dates
 */
export function generateRecurrenceDates(
  startDate: Date,
  endDate: Date,
  dayOfWeek: DayOfWeek
): Date[] {
  const dates: Date[] = [];
  const dayOrder = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const targetDay = dayOrder.indexOf(dayOfWeek);

  let currentDate = new Date(startDate);

  // Find first occurrence of the target day
  while (currentDate.getDay() !== targetDay && currentDate <= endDate) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Add all occurrences
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return dates;
}

// ============================================
// FILTERING FUNCTIONS
// ============================================

/**
 * Checks if a session date is in the past
 * @param sessionDate - Date of the session
 * @returns True if date is in the past
 */
export function isSlotInPast(sessionDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessionDate < today;
}

/**
 * Sorts slots by time
 * @param slots - Array of schedule slots
 * @returns Sorted array
 */
export function sortSlotsByTime(slots: ScheduleSlot[]): ScheduleSlot[] {
  return [...slots].sort((a, b) => {
    const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const dayDiff = dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
    if (dayDiff !== 0) return dayDiff;
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Checks if a time string is valid (HH:MM format)
 * @param time - Time string to validate
 * @returns True if valid
 */
export function isValidTime(time: string): boolean {
  const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

/**
 * Checks if an end time is after a start time
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @returns True if end time is after start time
 */
export function isEndTimeAfterStartTime(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) > timeToMinutes(startTime);
}

// ============================================
// DISPLAY HELPERS
// ============================================

/**
 * Gets a user-friendly description of a slot
 * @param slot - Schedule slot
 * @param teacherName - Teacher name (optional)
 * @param className - Class name (optional)
 * @param subjectName - Subject name (optional)
 * @returns Formatted description
 */
export function getSlotDescription(
  slot: ScheduleSlot,
  teacherName?: string,
  className?: string,
  subjectName?: string
): string {
  const parts: string[] = [];

  if (subjectName) parts.push(subjectName);
  if (teacherName) parts.push(`with ${teacherName}`);
  if (className) parts.push(`for ${className}`);
  parts.push(formatTimeSlot(slot.startTime, slot.endTime));

  return parts.join(" ");
}

/**
 * Formats schedule duration in a human-readable way
 * @param minutes - Duration in minutes
 * @returns Formatted string (e.g., "1h 30min")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}min`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins}min`;
  }
}
