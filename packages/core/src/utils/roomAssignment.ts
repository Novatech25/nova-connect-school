import type { RoomSizeCategory, DynamicRoomAssignmentConfig } from '../schemas';

interface ScheduleSlot {
  id: string;
  teacherId: string;
  subjectId: string;
  classId: string;
  campusId: string | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

interface Room {
  id: string;
  campusId: string;
  capacity: number | null;
  sizeCategory: RoomSizeCategory | null;
  isAvailable: boolean;
}

interface ClassEnrollment {
  classId: string;
  studentCount: number;
}

interface GroupedSession {
  teacherId: string;
  subjectId: string;
  campusId: string | null;
  startTime: string;
  endTime: string;
  classIds: string[];
  totalStudents: number;
  slotIds: string[];
}

/**
 * Regroupe les créneaux ayant même prof, matière, horaire, campus
 */
export function groupScheduleSlots(
  slots: ScheduleSlot[],
  enrollments: ClassEnrollment[]
): GroupedSession[] {
  const groups = new Map<string, GroupedSession>();

  for (const slot of slots) {
    const key = `${slot.teacherId}_${slot.subjectId}_${slot.campusId || 'null'}_${slot.startTime}_${slot.endTime}`;

    if (!groups.has(key)) {
      groups.set(key, {
        teacherId: slot.teacherId,
        subjectId: slot.subjectId,
        campusId: slot.campusId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        classIds: [],
        totalStudents: 0,
        slotIds: [],
      });
    }

    const group = groups.get(key)!;
    group.classIds.push(slot.classId);
    group.slotIds.push(slot.id);

    const enrollment = enrollments.find(e => e.classId === slot.classId);
    if (enrollment) {
      group.totalStudents += enrollment.studentCount;
    }
  }

  return Array.from(groups.values());
}

/**
 * Sélectionne la salle optimale selon la configuration
 */
export function selectOptimalRoom(
  availableRooms: Room[],
  requiredCapacity: number,
  config: DynamicRoomAssignmentConfig
): {
  room: Room | null;
  status: 'sufficient' | 'insufficient' | 'optimal';
  marginPercent: number | null;
} {
  const marginMultiplier = 1 + (config.capacityMarginPercent / 100);
  const targetCapacity = Math.ceil(requiredCapacity * marginMultiplier);

  // Filtrer les salles disponibles avec capacité connue
  const roomsWithCapacity = availableRooms.filter(r => r.capacity !== null && r.isAvailable);

  if (roomsWithCapacity.length === 0) {
    return { room: null, status: 'insufficient', marginPercent: null };
  }

  // Salles suffisantes (capacité >= target)
  const sufficientRooms = roomsWithCapacity.filter(r => r.capacity! >= targetCapacity);

  if (sufficientRooms.length > 0) {
    let selectedRoom: Room;

    if (config.selectionPriority === 'capacity') {
      // Choisir la plus grande salle disponible
      selectedRoom = sufficientRooms.reduce((max, r) =>
        r.capacity! > max.capacity! ? r : max
      );
    } else {
      // Choisir selon size_category (very_large > large > medium > small)
      const categoryOrder: RoomSizeCategory[] = ['very_large', 'large', 'medium', 'small'];
      const sortedRooms = sufficientRooms.sort((a, b) => {
        const aIndex = a.sizeCategory ? categoryOrder.indexOf(a.sizeCategory) : 999;
        const bIndex = b.sizeCategory ? categoryOrder.indexOf(b.sizeCategory) : 999;
        return aIndex - bIndex;
      });
      selectedRoom = sortedRooms[0]!;
    }

    const marginPercent = ((selectedRoom.capacity! - requiredCapacity) / requiredCapacity) * 100;
    const status = marginPercent >= config.capacityMarginPercent ? 'optimal' : 'sufficient';

    return { room: selectedRoom, status, marginPercent };
  }

  // Aucune salle suffisante : fallback sur la plus grande
  const largestRoom = roomsWithCapacity.reduce((max, r) =>
    r.capacity! > max.capacity! ? r : max
  );

  const marginPercent = ((largestRoom.capacity! - requiredCapacity) / requiredCapacity) * 100;

  return { room: largestRoom, status: 'insufficient', marginPercent };
}

/**
 * Vérifie si une salle est déjà réservée sur un créneau
 */
export function isRoomAvailableAtTime(
  roomId: string,
  _date: Date,
  startTime: string,
  endTime: string,
  existingAssignments: Array<{ assignedRoomId: string; startTime: string; endTime: string }>
): boolean {
  return !existingAssignments.some(assignment =>
    assignment.assignedRoomId === roomId &&
    isTimeOverlap(startTime, endTime, assignment.startTime, assignment.endTime)
  );
}

function isTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const [h1 = 0, m1 = 0] = start1.split(':').map(Number);
  const [h2 = 0, m2 = 0] = end1.split(':').map(Number);
  const [h3 = 0, m3 = 0] = start2.split(':').map(Number);
  const [h4 = 0, m4 = 0] = end2.split(':').map(Number);

  const start1Minutes = h1 * 60 + m1;
  const end1Minutes = h2 * 60 + m2;
  const start2Minutes = h3 * 60 + m3;
  const end2Minutes = h4 * 60 + m4;

  return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
}
