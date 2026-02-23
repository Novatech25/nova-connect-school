import { Hono } from 'hono';
import { getSchoolId } from '../middleware/rls.js';

const app = new Hono();

// Get schedule by class
app.get('/class/:classId', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const classId = c.req.param('classId');
  const semester = c.req.query('semester');
  const academicYear = c.req.query('academicYear');
  const dayOfWeek = c.req.query('dayOfWeek');

  let query = 'SELECT * FROM schedules WHERE school_id = ? AND class_id = ?';
  const params: any[] = [schoolId, classId];

  if (semester) {
    query += ' AND semester = ?';
    params.push(semester);
  }

  if (academicYear) {
    query += ' AND academic_year = ?';
    params.push(academicYear);
  }

  if (dayOfWeek) {
    query += ' AND day_of_week = ?';
    params.push(dayOfWeek);
  }

  query += ' ORDER BY day_of_week, start_time';

  const schedules = db.prepare(query).all(...params);
  return c.json(schedules);
});

// Get schedule by teacher
app.get('/teacher/:teacherId', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const teacherId = c.req.param('teacherId');
  const semester = c.req.query('semester');
  const academicYear = c.req.query('academicYear');
  const dayOfWeek = c.req.query('dayOfWeek');

  let query = 'SELECT * FROM schedules WHERE school_id = ? AND teacher_id = ?';
  const params: any[] = [schoolId, teacherId];

  if (semester) {
    query += ' AND semester = ?';
    params.push(semester);
  }

  if (academicYear) {
    query += ' AND academic_year = ?';
    params.push(academicYear);
  }

  if (dayOfWeek) {
    query += ' AND day_of_week = ?';
    params.push(dayOfWeek);
  }

  query += ' ORDER BY day_of_week, start_time';

  const schedules = db.prepare(query).all(...params);
  return c.json(schedules);
});

// Get schedule by student (through class)
app.get('/student/:studentId', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const studentId = c.req.param('studentId');
  const semester = c.req.query('semester');
  const academicYear = c.req.query('academicYear');

  // First get student's class
  const student = db.prepare(
    'SELECT class_id FROM students WHERE id = ? AND school_id = ?'
  ).get(studentId, schoolId) as any;

  if (!student) {
    return c.json({ error: 'Student not found' }, 404);
  }

  let query = 'SELECT * FROM schedules WHERE school_id = ? AND class_id = ?';
  const params: any[] = [schoolId, student.class_id];

  if (semester) {
    query += ' AND semester = ?';
    params.push(semester);
  }

  if (academicYear) {
    query += ' AND academic_year = ?';
    params.push(academicYear);
  }

  query += ' ORDER BY day_of_week, start_time';

  const schedules = db.prepare(query).all(...params);
  return c.json(schedules);
});

// Get schedule by ID
app.get('/:id', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const scheduleId = c.req.param('id');

  const schedule = db.prepare(
    'SELECT * FROM schedules WHERE id = ? AND school_id = ?'
  ).get(scheduleId, schoolId);

  if (!schedule) {
    return c.json({ error: 'Schedule not found' }, 404);
  }

  return c.json(schedule);
});

// Get weekly schedule for a class
app.get('/class/:classId/weekly', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const classId = c.req.param('classId');
  const semester = c.req.query('semester');
  const academicYear = c.req.query('academicYear');

  let query = `
    SELECT * FROM schedules
    WHERE school_id = ? AND class_id = ?
  `;
  const params: any[] = [schoolId, classId];

  if (semester) {
    query += ' AND semester = ?';
    params.push(semester);
  }

  if (academicYear) {
    query += ' AND academic_year = ?';
    params.push(academicYear);
  }

  query += ' ORDER BY day_of_week, start_time';

  const schedules = db.prepare(query).all(...params);

  // Group by day of week
  const weeklySchedule: any = {
    1: [], // Monday
    2: [], // Tuesday
    3: [], // Wednesday
    4: [], // Thursday
    5: [], // Friday
    6: [], // Saturday
    0: []  // Sunday
  };

  for (const schedule of schedules) {
    if (weeklySchedule[schedule.day_of_week] !== undefined) {
      weeklySchedule[schedule.day_of_week].push(schedule);
    }
  }

  return c.json(weeklySchedule);
});

// Note: Schedules are typically synced from Supabase Cloud
// The Gateway doesn't need to create/update schedules, only read them

export default app;
