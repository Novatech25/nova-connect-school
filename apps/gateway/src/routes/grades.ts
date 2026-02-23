import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { getSchoolId, getUserId } from '../middleware/rls.js';

const app = new Hono();

// Create grade
app.post('/', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const {
    studentId,
    classId,
    teacherId,
    subjectId,
    gradeType,
    value,
    maxValue,
    coefficient,
    gradingDate,
    comments
  } = await c.req.json();

  const id = randomUUID();

  db.prepare(`
    INSERT INTO grades (
      id, school_id, student_id, class_id, teacher_id, subject_id, grade_type,
      value, max_value, coefficient, grading_date, comments, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    schoolId,
    studentId,
    classId,
    teacherId,
    subjectId,
    gradeType,
    value,
    maxValue,
    coefficient || 1.0,
    gradingDate,
    comments || null,
    'draft'
  );

  // Add to event log
  eventLog.addEvent(schoolId, 'create', 'grades', id, {
    id,
    school_id: schoolId,
    student_id: studentId,
    class_id: classId,
    teacher_id: teacherId,
    subject_id: subjectId,
    grade_type: gradeType,
    value,
    max_value: maxValue,
    coefficient: coefficient || 1.0,
    grading_date: gradingDate,
    comments: comments || null,
    status: 'draft'
  }, userId);

  return c.json({ id, success: true });
});

// Bulk create grades
app.post('/bulk', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const { grades: gradesList } = await c.req.json();

  const ids: string[] = [];

  for (const grade of gradesList) {
    const id = randomUUID();

    db.prepare(`
      INSERT INTO grades (
        id, school_id, student_id, class_id, teacher_id, subject_id, grade_type,
        value, max_value, coefficient, grading_date, comments, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      schoolId,
      grade.studentId,
      grade.classId,
      grade.teacherId,
      grade.subjectId,
      grade.gradeType,
      grade.value,
      grade.maxValue,
      grade.coefficient || 1.0,
      grade.gradingDate,
      grade.comments || null,
      'draft'
    );

    eventLog.addEvent(schoolId, 'create', 'grades', id, {
      id,
      school_id: schoolId,
      student_id: grade.studentId,
      class_id: grade.classId,
      teacher_id: grade.teacherId,
      subject_id: grade.subjectId,
      grade_type: grade.gradeType,
      value: grade.value,
      max_value: grade.maxValue,
      coefficient: grade.coefficient || 1.0,
      grading_date: grade.gradingDate,
      comments: grade.comments || null,
      status: 'draft'
    }, userId);

    ids.push(id);
  }

  return c.json({ ids, success: true, count: ids.length });
});

// Update grade
app.patch('/:id', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const gradeId = c.req.param('id');
  const { value, maxValue, coefficient, comments, status } = await c.req.json();

  const updateData: any = {};
  if (value !== undefined) updateData.value = value;
  if (maxValue !== undefined) updateData.max_value = maxValue;
  if (coefficient !== undefined) updateData.coefficient = coefficient;
  if (comments !== undefined) updateData.comments = comments;
  if (status !== undefined) updateData.status = status;

  const setClause = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updateData);

  db.prepare(`
    UPDATE grades
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ? AND school_id = ?
  `).run(...values, gradeId, schoolId);

  eventLog.addEvent(schoolId, 'update', 'grades', gradeId, updateData, userId);

  return c.json({ success: true });
});

// Publish grades
app.patch('/sessions/:sessionId/publish', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const sessionId = c.req.param('sessionId');
  const { classId, subjectId, gradingDate } = await c.req.json();

  // Validate required parameters
  if (!classId || !subjectId || !gradingDate) {
    return c.json({ error: 'Missing required parameters: classId, subjectId, gradingDate' }, 400);
  }

  // Update all matching grades to published status
  const result = db.prepare(`
    UPDATE grades
    SET status = 'published', published_at = datetime('now'), updated_at = datetime('now')
    WHERE school_id = ? AND class_id = ? AND subject_id = ? AND grading_date = ?
  `).run(schoolId, classId, subjectId, gradingDate);

  // Log the update event
  eventLog.addEvent(schoolId, 'update', 'grades', sessionId, {
    class_id: classId,
    subject_id: subjectId,
    grading_date: gradingDate,
    status: 'published',
    published_at: new Date().toISOString(),
    affected_rows: result.changes
  }, userId);

  return c.json({
    success: true,
    affectedRows: result.changes
  });
});

// Get grades by student
app.get('/student/:studentId', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const studentId = c.req.param('studentId');
  const subjectId = c.req.query('subjectId');
  const classId = c.req.query('classId');

  let query = 'SELECT * FROM grades WHERE school_id = ? AND student_id = ?';
  const params: any[] = [schoolId, studentId];

  if (subjectId) {
    query += ' AND subject_id = ?';
    params.push(subjectId);
  }

  if (classId) {
    query += ' AND class_id = ?';
    params.push(classId);
  }

  query += ' ORDER BY grading_date DESC';

  const grades = db.prepare(query).all(...params);
  return c.json(grades);
});

// Get grades by class
app.get('/class/:classId', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const classId = c.req.param('classId');
  const subjectId = c.req.query('subjectId');

  let query = 'SELECT * FROM grades WHERE school_id = ? AND class_id = ?';
  const params: any[] = [schoolId, classId];

  if (subjectId) {
    query += ' AND subject_id = ?';
    params.push(subjectId);
  }

  query += ' ORDER BY student_id, grading_date DESC';

  const grades = db.prepare(query).all(...params);
  return c.json(grades);
});

// Get grade by ID
app.get('/:id', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const gradeId = c.req.param('id');

  const grade = db.prepare(
    'SELECT * FROM grades WHERE id = ? AND school_id = ?'
  ).get(gradeId, schoolId);

  if (!grade) {
    return c.json({ error: 'Grade not found' }, 404);
  }

  return c.json(grade);
});

// Delete grade
app.delete('/:id', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const gradeId = c.req.param('id');

  // Check if grade exists
  const grade = db.prepare(
    'SELECT id FROM grades WHERE id = ? AND school_id = ?'
  ).get(gradeId, schoolId);

  if (!grade) {
    return c.json({ error: 'Grade not found' }, 404);
  }

  db.prepare('DELETE FROM grades WHERE id = ? AND school_id = ?').run(gradeId, schoolId);

  eventLog.addEvent(schoolId, 'delete', 'grades', gradeId, {
    id: gradeId
  }, userId);

  return c.json({ success: true });
});

export default app;
