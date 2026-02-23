import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { getSchoolId, getUserId } from '../middleware/rls.js';

const app = new Hono();

const getValue = (payload: any, camel: string, snake: string) =>
  payload?.[camel] ?? payload?.[snake];

app.post('/', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const payload = await c.req.json();
  const id = randomUUID();
  const now = new Date().toISOString();

  const relationship = getValue(payload, 'relationship', 'relationship');
  const isPrimary = Boolean(getValue(payload, 'isPrimary', 'is_primary'));
  const canPickup =
    getValue(payload, 'canPickup', 'can_pickup') !== undefined
      ? Boolean(getValue(payload, 'canPickup', 'can_pickup'))
      : true;
  const canViewGrades =
    getValue(payload, 'canViewGrades', 'can_view_grades') !== undefined
      ? Boolean(getValue(payload, 'canViewGrades', 'can_view_grades'))
      : true;
  const canViewAttendance =
    getValue(payload, 'canViewAttendance', 'can_view_attendance') !== undefined
      ? Boolean(getValue(payload, 'canViewAttendance', 'can_view_attendance'))
      : true;

  db.prepare(
    `
      INSERT INTO student_parent_relations (
        id,
        school_id,
        student_id,
        parent_id,
        relationship,
        is_primary,
        can_pickup,
        can_view_grades,
        can_view_attendance,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    id,
    schoolId,
    getValue(payload, 'studentId', 'student_id'),
    getValue(payload, 'parentId', 'parent_id'),
    relationship || null,
    isPrimary ? 1 : 0,
    canPickup ? 1 : 0,
    canViewGrades ? 1 : 0,
    canViewAttendance ? 1 : 0,
    now
  );

  const eventData = {
    id,
    school_id: schoolId,
    student_id: getValue(payload, 'studentId', 'student_id'),
    parent_id: getValue(payload, 'parentId', 'parent_id'),
    relationship: relationship || null,
    is_primary: isPrimary,
    can_pickup: canPickup,
    can_view_grades: canViewGrades,
    can_view_attendance: canViewAttendance,
    created_at: now,
  };

  eventLog.addEvent(schoolId, 'create', 'student_parent_relations', id, eventData, userId);

  return c.json(eventData);
});

export default app;
