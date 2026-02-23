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

  const enrollmentDate =
    getValue(payload, 'enrollmentDate', 'enrollment_date') ||
    new Date().toISOString().split('T')[0];
  const status = getValue(payload, 'status', 'status') || 'enrolled';

  db.prepare(
    `
      INSERT INTO enrollments (
        id,
        school_id,
        student_id,
        class_id,
        academic_year_id,
        enrollment_date,
        status,
        withdrawal_date,
        withdrawal_reason,
        is_repeating,
        previous_class_id,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    id,
    schoolId,
    getValue(payload, 'studentId', 'student_id'),
    getValue(payload, 'classId', 'class_id'),
    getValue(payload, 'academicYearId', 'academic_year_id'),
    enrollmentDate,
    status,
    getValue(payload, 'withdrawalDate', 'withdrawal_date') || null,
    getValue(payload, 'withdrawalReason', 'withdrawal_reason') || null,
    getValue(payload, 'isRepeating', 'is_repeating') ? 1 : 0,
    getValue(payload, 'previousClassId', 'previous_class_id') || null,
    getValue(payload, 'notes', 'notes') || null,
    now,
    now
  );

  const eventData = {
    id,
    school_id: schoolId,
    student_id: getValue(payload, 'studentId', 'student_id'),
    class_id: getValue(payload, 'classId', 'class_id'),
    academic_year_id: getValue(payload, 'academicYearId', 'academic_year_id'),
    enrollment_date: enrollmentDate,
    status,
    withdrawal_date: getValue(payload, 'withdrawalDate', 'withdrawal_date') || null,
    withdrawal_reason: getValue(payload, 'withdrawalReason', 'withdrawal_reason') || null,
    is_repeating: Boolean(getValue(payload, 'isRepeating', 'is_repeating')),
    previous_class_id: getValue(payload, 'previousClassId', 'previous_class_id') || null,
    notes: getValue(payload, 'notes', 'notes') || null,
    created_at: now,
    updated_at: now,
  };

  eventLog.addEvent(schoolId, 'create', 'enrollments', id, eventData, userId);

  return c.json(eventData);
});

export default app;
