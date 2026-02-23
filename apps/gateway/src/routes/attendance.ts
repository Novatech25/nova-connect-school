import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { getSchoolId, getUserId } from '../middleware/rls.js';

const app = new Hono();

// Create attendance session
app.post('/sessions', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const { plannedSessionId, teacherId, classId, sessionDate } = await c.req.json();

  const id = randomUUID();

  db.prepare(`
    INSERT INTO attendance_sessions (id, school_id, planned_session_id, teacher_id, class_id, session_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, schoolId, plannedSessionId, teacherId, classId, sessionDate);

  // Add to event log
  eventLog.addEvent(schoolId, 'create', 'attendance_sessions', id, {
    id,
    school_id: schoolId,
    planned_session_id: plannedSessionId,
    teacher_id: teacherId,
    class_id: classId,
    session_date: sessionDate
  }, userId);

  return c.json({ id, success: true });
});

// Mark attendance
app.post('/records', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const {
    attendanceSessionId,
    studentId,
    status,
    source,
    justification,
    comment
  } = await c.req.json();

  const id = randomUUID();

  db.prepare(`
    INSERT INTO attendance_records (
      id, attendance_session_id, school_id, student_id, status, source, justification, comment, marked_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, attendanceSessionId, schoolId, studentId, status, source, justification, comment, userId);

  // Add to event log
  eventLog.addEvent(schoolId, 'create', 'attendance_records', id, {
    id,
    attendance_session_id: attendanceSessionId,
    school_id: schoolId,
    student_id: studentId,
    status,
    source,
    justification,
    comment,
    marked_by: userId
  }, userId);

  return c.json({ id, success: true });
});

// Bulk mark attendance
app.post('/records/bulk', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const { attendanceSessionId, records } = await c.req.json();

  const ids: string[] = [];

  for (const record of records) {
    const id = randomUUID();

    db.prepare(`
      INSERT INTO attendance_records (
        id, attendance_session_id, school_id, student_id, status, source, justification, comment, marked_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      attendanceSessionId,
      schoolId,
      record.studentId,
      record.status,
      record.source || 'teacher_manual',
      record.justification || null,
      record.comment || null,
      userId
    );

    eventLog.addEvent(schoolId, 'create', 'attendance_records', id, {
      id,
      attendance_session_id: attendanceSessionId,
      school_id: schoolId,
      student_id: record.studentId,
      status: record.status,
      source: record.source || 'teacher_manual',
      justification: record.justification || null,
      comment: record.comment || null,
      marked_by: userId
    }, userId);

    ids.push(id);
  }

  return c.json({ ids, success: true, count: ids.length });
});

// Submit session
app.patch('/sessions/:id/submit', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const sessionId = c.req.param('id');

  db.prepare(`
    UPDATE attendance_sessions
    SET status = 'submitted', submitted_at = datetime('now')
    WHERE id = ? AND school_id = ?
  `).run(sessionId, schoolId);

  eventLog.addEvent(schoolId, 'update', 'attendance_sessions', sessionId, {
    status: 'submitted',
    submitted_at: new Date().toISOString()
  }, userId);

  return c.json({ success: true });
});

// Validate session
app.patch('/sessions/:id/validate', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const sessionId = c.req.param('id');

  db.prepare(`
    UPDATE attendance_sessions
    SET status = 'validated', validated_at = datetime('now'), validated_by = ?
    WHERE id = ? AND school_id = ?
  `).run(userId, sessionId, schoolId);

  eventLog.addEvent(schoolId, 'update', 'attendance_sessions', sessionId, {
    status: 'validated',
    validated_at: new Date().toISOString(),
    validated_by: userId
  }, userId);

  return c.json({ success: true });
});

// Get sessions
app.get('/sessions', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const teacherId = c.req.query('teacherId');
  const date = c.req.query('date');
  const classId = c.req.query('classId');
  const status = c.req.query('status');

  let query = 'SELECT * FROM attendance_sessions WHERE school_id = ?';
  const params: any[] = [schoolId];

  if (teacherId) {
    query += ' AND teacher_id = ?';
    params.push(teacherId);
  }

  if (date) {
    query += ' AND session_date = ?';
    params.push(date);
  }

  if (classId) {
    query += ' AND class_id = ?';
    params.push(classId);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY session_date DESC, created_at DESC';

  const sessions = db.prepare(query).all(...params);
  return c.json(sessions);
});

// Get session by ID
app.get('/sessions/:id', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const sessionId = c.req.param('id');

  const session = db.prepare(
    'SELECT * FROM attendance_sessions WHERE id = ? AND school_id = ?'
  ).get(sessionId, schoolId);

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json(session);
});

// Get records for a session
app.get('/sessions/:id/records', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const sessionId = c.req.param('id');

  // Verify session belongs to school
  const session = db.prepare(
    'SELECT id FROM attendance_sessions WHERE id = ? AND school_id = ?'
  ).get(sessionId, schoolId);

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const records = db.prepare(
    'SELECT * FROM attendance_records WHERE attendance_session_id = ? AND school_id = ?'
  ).all(sessionId, schoolId);

  return c.json(records);
});

// Update attendance record
app.patch('/records/:id', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const recordId = c.req.param('id');
  const { status, justification, comment } = await c.req.json();

  const updateData: any = {};
  if (status !== undefined) updateData.status = status;
  if (justification !== undefined) updateData.justification = justification;
  if (comment !== undefined) updateData.comment = comment;

  const setClause = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updateData);

  db.prepare(`
    UPDATE attendance_records
    SET ${setClause}
    WHERE id = ? AND school_id = ?
  `).run(...values, recordId, schoolId);

  eventLog.addEvent(schoolId, 'update', 'attendance_records', recordId, updateData, userId);

  return c.json({ success: true });
});

export default app;
