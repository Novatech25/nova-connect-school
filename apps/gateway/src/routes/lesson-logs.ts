import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { getSchoolId, getUserId } from '../middleware/rls.js';

const app = new Hono();

// Create lesson log (cahier de texte)
app.post('/', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const {
    classId,
    teacherId,
    subjectId,
    lessonDate,
    plannedSessionId,
    content,
    homework,
    attachments
  } = await c.req.json();

  const id = randomUUID();

  db.prepare(`
    INSERT INTO lesson_logs (
      id, school_id, class_id, teacher_id, subject_id, lesson_date,
      planned_session_id, content, homework, attachments, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    schoolId,
    classId,
    teacherId,
    subjectId,
    lessonDate,
    plannedSessionId || null,
    content,
    homework || null,
    attachments ? JSON.stringify(attachments) : null,
    'draft'
  );

  // Add to event log
  eventLog.addEvent(schoolId, 'create', 'lesson_logs', id, {
    id,
    school_id: schoolId,
    class_id: classId,
    teacher_id: teacherId,
    subject_id: subjectId,
    lesson_date: lessonDate,
    planned_session_id: plannedSessionId || null,
    content,
    homework: homework || null,
    attachments: attachments || null,
    status: 'draft'
  }, userId);

  return c.json({ id, success: true });
});

// Update lesson log
app.patch('/:id', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const logId = c.req.param('id');
  const { content, homework, attachments, status } = await c.req.json();

  const updateData: any = {};
  if (content !== undefined) updateData.content = content;
  if (homework !== undefined) updateData.homework = homework;
  if (attachments !== undefined) updateData.attachments = JSON.stringify(attachments);
  if (status !== undefined) updateData.status = status;

  const setClause = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updateData);

  db.prepare(`
    UPDATE lesson_logs
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ? AND school_id = ?
  `).run(...values, logId, schoolId);

  eventLog.addEvent(schoolId, 'update', 'lesson_logs', logId, updateData, userId);

  return c.json({ success: true });
});

// Validate lesson log
app.patch('/:id/validate', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const logId = c.req.param('id');

  db.prepare(`
    UPDATE lesson_logs
    SET status = 'validated', validated_at = datetime('now'), validated_by = ?, updated_at = datetime('now')
    WHERE id = ? AND school_id = ?
  `).run(userId, logId, schoolId);

  eventLog.addEvent(schoolId, 'update', 'lesson_logs', logId, {
    status: 'validated',
    validated_at: new Date().toISOString(),
    validated_by: userId
  }, userId);

  return c.json({ success: true });
});

// Get lesson logs by class
app.get('/class/:classId', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const classId = c.req.param('classId');
  const subjectId = c.req.query('subjectId');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  let query = 'SELECT * FROM lesson_logs WHERE school_id = ? AND class_id = ?';
  const params: any[] = [schoolId, classId];

  if (subjectId) {
    query += ' AND subject_id = ?';
    params.push(subjectId);
  }

  if (startDate) {
    query += ' AND lesson_date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND lesson_date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY lesson_date DESC';

  const logs = db.prepare(query).all(...params);
  return c.json(logs);
});

// Get lesson logs by teacher
app.get('/teacher/:teacherId', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const teacherId = c.req.param('teacherId');
  const subjectId = c.req.query('subjectId');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  let query = 'SELECT * FROM lesson_logs WHERE school_id = ? AND teacher_id = ?';
  const params: any[] = [schoolId, teacherId];

  if (subjectId) {
    query += ' AND subject_id = ?';
    params.push(subjectId);
  }

  if (startDate) {
    query += ' AND lesson_date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND lesson_date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY lesson_date DESC';

  const logs = db.prepare(query).all(...params);
  return c.json(logs);
});

// Get lesson log by ID
app.get('/:id', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const logId = c.req.param('id');

  const log = db.prepare(
    'SELECT * FROM lesson_logs WHERE id = ? AND school_id = ?'
  ).get(logId, schoolId);

  if (!log) {
    return c.json({ error: 'Lesson log not found' }, 404);
  }

  // Parse attachments if JSON
  if (log.attachments) {
    try {
      log.attachments = JSON.parse(log.attachments);
    } catch (e) {
      // Keep as is
    }
  }

  return c.json(log);
});

// Delete lesson log
app.delete('/:id', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const logId = c.req.param('id');

  // Check if log exists
  const log = db.prepare(
    'SELECT id FROM lesson_logs WHERE id = ? AND school_id = ?'
  ).get(logId, schoolId);

  if (!log) {
    return c.json({ error: 'Lesson log not found' }, 404);
  }

  db.prepare('DELETE FROM lesson_logs WHERE id = ? AND school_id = ?').run(logId, schoolId);

  eventLog.addEvent(schoolId, 'delete', 'lesson_logs', logId, {
    id: logId
  }, userId);

  return c.json({ success: true });
});

export default app;
