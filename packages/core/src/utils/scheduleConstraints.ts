import type {
  ScheduleSlot,
  ScheduleConstraint,
  ConstraintType,
  DayOfWeek,
} from "../schemas/schedule";

// ============================================
// TYPES
// ============================================

export interface ConstraintViolation {
  type: ConstraintType;
  severity: "error" | "warning";
  message: string;
  affectedSlots: string[]; // IDs of slots in conflict
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ConstraintViolation[];
}

export interface TimeRange {
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

// Re-export types from schemas for convenience
export type { ScheduleSlot, ScheduleConstraint, ConstraintType, DayOfWeek };

// ============================================
// TIME UTILITIES
// ============================================

/**
 * Calculates the duration in minutes between two times
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @returns Duration in minutes
 */
export function calculateSlotDuration(startTime: string, endTime: string): number {
  const [startHours = 0, startMinutes = 0] = startTime.split(":").map(Number);
  const [endHours = 0, endMinutes = 0] = endTime.split(":").map(Number);

  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;

  return endTotalMinutes - startTotalMinutes;
}

/**
 * Checks if two time ranges overlap
 * @param slot1 - First slot with time range
 * @param slot2 - Second slot with time range
 * @returns True if slots overlap
 */
export function checkTimeOverlap(
  slot1: { startTime: string; endTime: string },
  slot2: { startTime: string; endTime: string }
): boolean {
  const start1 = calculateSlotDuration("00:00", slot1.startTime);
  const end1 = calculateSlotDuration("00:00", slot1.endTime);
  const start2 = calculateSlotDuration("00:00", slot2.startTime);
  const end2 = calculateSlotDuration("00:00", slot2.endTime);

  return start1 < end2 && end1 > start2;
}

// ============================================
// CONSTRAINT CHECKING FUNCTIONS
// ============================================

/**
 * Checks if a teacher has conflicting slots
 * @param slot - The slot to check
 * @param existingSlots - All existing slots to check against
 * @returns Array of violations if conflicts found
 */
export function checkTeacherConflict(
  slot: ScheduleSlot,
  existingSlots: ScheduleSlot[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const conflicts = existingSlots.filter(
    (s) =>
      s.teacherId === slot.teacherId &&
      s.dayOfWeek === slot.dayOfWeek &&
      s.id !== slot.id &&
      checkTimeOverlap(s, slot)
  );

  if (conflicts.length > 0) {
    violations.push({
      type: "teacher_conflict",
      severity: "error",
      message: `Teacher has ${conflicts.length} conflicting slot(s)`,
      affectedSlots: conflicts.map((s) => s.id),
    });
  }

  return violations;
}

/**
 * Checks if a room has conflicting slots
 * @param slot - The slot to check
 * @param existingSlots - All existing slots to check against
 * @returns Array of violations if conflicts found
 */
export function checkRoomConflict(
  slot: ScheduleSlot,
  existingSlots: ScheduleSlot[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  if (!slot.roomId) return violations;

  const conflicts = existingSlots.filter(
    (s) =>
      s.roomId === slot.roomId &&
      s.dayOfWeek === slot.dayOfWeek &&
      s.id !== slot.id &&
      checkTimeOverlap(s, slot)
  );

  if (conflicts.length > 0) {
    violations.push({
      type: "room_conflict",
      severity: "error",
      message: `Room has ${conflicts.length} conflicting slot(s)`,
      affectedSlots: conflicts.map((s) => s.id),
    });
  }

  return violations;
}

/**
 * Checks if a class has conflicting slots
 * @param slot - The slot to check
 * @param existingSlots - All existing slots to check against
 * @returns Array of violations if conflicts found
 */
export function checkClassConflict(
  slot: ScheduleSlot,
  existingSlots: ScheduleSlot[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const conflicts = existingSlots.filter(
    (s) =>
      s.classId === slot.classId &&
      s.dayOfWeek === slot.dayOfWeek &&
      s.id !== slot.id &&
      checkTimeOverlap(s, slot)
  );

  if (conflicts.length > 0) {
    violations.push({
      type: "class_conflict",
      severity: "error",
      message: `Class has ${conflicts.length} conflicting slot(s)`,
      affectedSlots: conflicts.map((s) => s.id),
    });
  }

  return violations;
}

/**
 * Checks if adding a slot would exceed max hours per day for a teacher
 * @param slot - The slot to check
 * @param existingSlots - All existing slots for the teacher
 * @param maxHoursPerDay - Maximum allowed hours per day
 * @returns Array of violations if limit exceeded
 */
export function checkMaxHoursPerDay(
  slot: ScheduleSlot,
  existingSlots: ScheduleSlot[],
  maxHoursPerDay: number
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const daySlots = existingSlots.filter(
    (s) => s.teacherId === slot.teacherId && s.dayOfWeek === slot.dayOfWeek
  );

  const currentMinutes = daySlots.reduce(
    (sum, s) => sum + calculateSlotDuration(s.startTime, s.endTime),
    0
  );
  const newSlotMinutes = calculateSlotDuration(slot.startTime, slot.endTime);
  const totalHours = (currentMinutes + newSlotMinutes) / 60;

  if (totalHours > maxHoursPerDay) {
    violations.push({
      type: "max_hours_per_day",
      severity: "warning",
      message: `Would exceed ${maxHoursPerDay} hours per day (total: ${totalHours.toFixed(1)}h)`,
      affectedSlots: [...daySlots.map((s) => s.id), slot.id],
    });
  }

  return violations;
}

/**
 * Checks if adding a slot would exceed max hours per week for a teacher
 * @param slot - The slot to check
 * @param existingSlots - All existing slots for the teacher
 * @param maxHoursPerWeek - Maximum allowed hours per week
 * @returns Array of violations if limit exceeded
 */
export function checkMaxHoursPerWeek(
  slot: ScheduleSlot,
  existingSlots: ScheduleSlot[],
  maxHoursPerWeek: number
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const teacherSlots = existingSlots.filter((s) => s.teacherId === slot.teacherId);

  const currentMinutes = teacherSlots.reduce(
    (sum, s) => sum + calculateSlotDuration(s.startTime, s.endTime),
    0
  );
  const newSlotMinutes = calculateSlotDuration(slot.startTime, slot.endTime);
  const totalHours = (currentMinutes + newSlotMinutes) / 60;

  if (totalHours > maxHoursPerWeek) {
    violations.push({
      type: "max_hours_per_week",
      severity: "warning",
      message: `Would exceed ${maxHoursPerWeek} hours per week (total: ${totalHours.toFixed(1)}h)`,
      affectedSlots: [...teacherSlots.map((s) => s.id), slot.id],
    });
  }

  return violations;
}

/**
 * Checks if a slot is within teacher's availability
 * @param slot - The slot to check
 * @param availability - Teacher's availability configuration
 * @returns Array of violations if outside availability
 */
export function checkTeacherAvailability(
  slot: ScheduleSlot,
  availability: Record<DayOfWeek, TimeRange | null>
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const dayAvailability = availability[slot.dayOfWeek];
  if (!dayAvailability) {
    violations.push({
      type: "teacher_unavailable",
      severity: "error",
      message: `Teacher is not available on ${slot.dayOfWeek}`,
      affectedSlots: [slot.id],
    });
    return violations;
  }

  const slotStart = calculateSlotDuration("00:00", slot.startTime);
  const slotEnd = calculateSlotDuration("00:00", slot.endTime);
  const availStart = calculateSlotDuration("00:00", dayAvailability.startTime);
  const availEnd = calculateSlotDuration("00:00", dayAvailability.endTime);

  if (slotStart < availStart || slotEnd > availEnd) {
    violations.push({
      type: "outside_availability",
      severity: "warning",
      message: `Slot is outside teacher's availability (${dayAvailability.startTime}-${dayAvailability.endTime})`,
      affectedSlots: [slot.id],
    });
  }

  return violations;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validates a schedule slot against all constraints
 * @param slot - The slot to validate
 * @param existingSlots - All existing slots in the schedule
 * @param constraints - Active constraints to check
 * @param teacherAvailability - Optional teacher availability configuration
 * @returns ValidationResult with list of violations
 */
export function validateScheduleSlot(
  slot: ScheduleSlot,
  existingSlots: ScheduleSlot[],
  constraints: ScheduleConstraint[],
  teacherAvailability?: Record<string, TimeRange>
): ValidationResult {
  const violations: ConstraintViolation[] = [];

  // Check hard constraints (conflicts)
  violations.push(...checkTeacherConflict(slot, existingSlots));
  violations.push(...checkRoomConflict(slot, existingSlots));
  violations.push(...checkClassConflict(slot, existingSlots));

  // Check soft constraints (limits)
  for (const constraint of constraints) {
    const config = constraint.constraintConfig as { maxHours?: number };
    switch (constraint.constraintType) {
      case "max_hours_per_day":
        if (config?.maxHours) {
          violations.push(
            ...checkMaxHoursPerDay(slot, existingSlots, config.maxHours)
          );
        }
        break;
      case "max_hours_per_week":
        if (config?.maxHours) {
          violations.push(
            ...checkMaxHoursPerWeek(slot, existingSlots, config.maxHours)
          );
        }
        break;
    }
  }

  // Check teacher availability if provided
  if (teacherAvailability && teacherAvailability[slot.teacherId]) {
    const availability = {
      [slot.dayOfWeek]: teacherAvailability[slot.teacherId],
    } as Record<DayOfWeek, TimeRange>;
    violations.push(...checkTeacherAvailability(slot, availability));
  }

  return {
    isValid: violations.filter((v) => v.severity === "error").length === 0,
    violations,
  };
}

/**
 * Validates an entire schedule
 * @param _scheduleId - Schedule ID (unused but kept for API compatibility)
 * @param slots - All slots in the schedule
 * @param constraints - Active constraints
 * @param teacherAvailability - Optional teacher availability configuration
 * @returns ValidationResult with aggregated list of violations
 */
export function validateSchedule(
  _scheduleId: string,
  slots: ScheduleSlot[],
  constraints: ScheduleConstraint[],
  teacherAvailability?: Record<string, unknown>
): ValidationResult {
  const allViolations: ConstraintViolation[] = [];

  // Validate each slot against all existing slots
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot) continue;
    const existingSlots = slots.slice(0, i);

    const result = validateScheduleSlot(
      slot,
      existingSlots,
      constraints,
      teacherAvailability as Record<string, TimeRange>
    );

    allViolations.push(...result.violations);
  }

  return {
    isValid: allViolations.filter((v) => v.severity === "error").length === 0,
    violations: allViolations,
  };
}

/**
 * Finds all slots that conflict with a given slot
 * @param slot - The slot to check
 * @param slots - All slots to check against
 * @returns Array of conflicting slot IDs
 */
export function findConflictingSlots(slot: ScheduleSlot, slots: ScheduleSlot[]): string[] {
  const conflicts = new Set<string>();

  // Check teacher conflicts
  const teacherConflicts = slots.filter(
    (s) =>
      s.teacherId === slot.teacherId &&
      s.dayOfWeek === slot.dayOfWeek &&
      s.id !== slot.id
  );
  teacherConflicts.forEach((s) => {
    if (checkTimeOverlap(s, slot)) {
      conflicts.add(s.id);
    }
  });

  // Check room conflicts
  if (slot.roomId) {
    const roomConflicts = slots.filter(
      (s) =>
        s.roomId === slot.roomId &&
        s.dayOfWeek === slot.dayOfWeek &&
        s.id !== slot.id
    );
    roomConflicts.forEach((s) => {
      if (checkTimeOverlap(s, slot)) {
        conflicts.add(s.id);
      }
    });
  }

  // Check class conflicts
  const classConflicts = slots.filter(
    (s) =>
      s.classId === slot.classId &&
      s.dayOfWeek === slot.dayOfWeek &&
      s.id !== slot.id
  );
  classConflicts.forEach((s) => {
    if (checkTimeOverlap(s, slot)) {
      conflicts.add(s.id);
    }
  });

  return Array.from(conflicts);
}
