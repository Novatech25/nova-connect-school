import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { getSchoolId, getUserId } from '../middleware/rls.js';

const app = new Hono();

const getValue = (payload: any, camel: string, snake: string) =>
  payload?.[camel] ?? payload?.[snake];

const toJsonString = (value: any) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
};

app.post('/', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const payload = await c.req.json();

  const id = randomUUID();
  const matricule = getValue(payload, 'matricule', 'matricule') || '';
  const studentNumber = matricule || `LOCAL-${id.slice(0, 8)}`;
  const status = getValue(payload, 'status', 'status') || 'active';
  const isActive = status === 'active' ? 1 : 0;
  const now = new Date().toISOString();

  const dateOfBirth = getValue(payload, 'dateOfBirth', 'date_of_birth');
  const enrollmentDate = getValue(payload, 'enrollmentDate', 'enrollment_date');

  const medicalInfo = getValue(payload, 'medicalInfo', 'medical_info');
  const metadata = getValue(payload, 'metadata', 'metadata');

  db.prepare(
    `
      INSERT INTO students (
        id,
        school_id,
        user_id,
        student_number,
        matricule,
        first_name,
        last_name,
        date_of_birth,
        gender,
        place_of_birth,
        nationality,
        address,
        city,
        phone,
        email,
        photo_url,
        status,
        medical_info,
        metadata,
        class_id,
        enrollment_date,
        is_active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    id,
    schoolId,
    getValue(payload, 'userId', 'user_id') || null,
    studentNumber,
    matricule || null,
    getValue(payload, 'firstName', 'first_name'),
    getValue(payload, 'lastName', 'last_name'),
    dateOfBirth,
    getValue(payload, 'gender', 'gender') || null,
    getValue(payload, 'placeOfBirth', 'place_of_birth') || null,
    getValue(payload, 'nationality', 'nationality') || null,
    getValue(payload, 'address', 'address') || null,
    getValue(payload, 'city', 'city') || null,
    getValue(payload, 'phone', 'phone') || null,
    getValue(payload, 'email', 'email') || null,
    getValue(payload, 'photoUrl', 'photo_url') || null,
    status,
    toJsonString(medicalInfo),
    toJsonString(metadata),
    getValue(payload, 'classId', 'class_id') || null,
    enrollmentDate || null,
    isActive,
    now,
    now
  );

  const eventData = {
    id,
    school_id: schoolId,
    user_id: getValue(payload, 'userId', 'user_id') || null,
    matricule: matricule || null,
    first_name: getValue(payload, 'firstName', 'first_name'),
    last_name: getValue(payload, 'lastName', 'last_name'),
    date_of_birth: dateOfBirth,
    gender: getValue(payload, 'gender', 'gender') || null,
    place_of_birth: getValue(payload, 'placeOfBirth', 'place_of_birth') || null,
    nationality: getValue(payload, 'nationality', 'nationality') || null,
    address: getValue(payload, 'address', 'address') || null,
    city: getValue(payload, 'city', 'city') || null,
    phone: getValue(payload, 'phone', 'phone') || null,
    email: getValue(payload, 'email', 'email') || null,
    photo_url: getValue(payload, 'photoUrl', 'photo_url') || null,
    status,
    medical_info: medicalInfo || {},
    metadata: metadata || {},
    created_at: now,
    updated_at: now,
  };

  eventLog.addEvent(schoolId, 'create', 'students', id, eventData, userId);

  return c.json(eventData);
});

// GET /students - Récupérer tous les étudiants avec filtres
app.get('/', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);

  const status = c.req.query('status');
  const classId = c.req.query('classId');

  let query = `
    SELECT
      s.*,
      json_object(
        'id', u.id,
        'email', u.email,
        'first_name', u.first_name,
        'last_name', u.last_name,
        'role', u.role
      ) as user
    FROM students s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.school_id = ?
  `;

  const params: any[] = [schoolId];

  if (status) {
    query += ` AND s.status = ?`;
    params.push(status);
  }

  if (classId) {
    query += ` AND s.id IN (SELECT student_id FROM enrollments WHERE class_id = ?)`;
    params.push(classId);
  }

  query += ` ORDER BY s.last_name ASC`;

  const students = db.prepare(query).all(...params);

  // Récupérer les inscriptions pour chaque étudiant
  for (const student of students as any) {
    const enrollments = db.prepare(`
      SELECT
        e.*,
        json_object('id', c.id, 'name', c.name, 'level_id', c.level_id) as class,
        json_object('id', ay.id, 'name', ay.name, 'is_current', ay.is_current) as academic_year
      FROM enrollments e
      LEFT JOIN classes c ON e.class_id = c.id
      LEFT JOIN academic_years ay ON e.academic_year_id = ay.id
      WHERE e.student_id = ?
      ORDER BY e.enrollment_date DESC
    `).all(student.id);

    (student as any).enrollments = enrollments;
  }

  return c.json(students);
});

// GET /students/:id - Récupérer un étudiant par ID
app.get('/:id', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const id = c.req.param('id');

  const student = db.prepare(`
    SELECT
      s.*,
      json_object(
        'id', u.id,
        'email', u.email,
        'first_name', u.first_name,
        'last_name', u.last_name,
        'role', u.role
      ) as user
    FROM students s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.school_id = ?
  `).get(id, schoolId) as any;

  if (!student) {
    return c.json({ error: 'Student not found' }, 404);
  }

  // Récupérer les inscriptions
  const enrollments = db.prepare(`
    SELECT
      e.*,
      json_object('id', c.id, 'name', c.name, 'level_id', c.level_id) as class,
      json_object('id', ay.id, 'name', ay.name, 'is_current', ay.is_current) as academic_year
    FROM enrollments e
    LEFT JOIN classes c ON e.class_id = c.id
    LEFT JOIN academic_years ay ON e.academic_year_id = ay.id
    WHERE e.student_id = ?
    ORDER BY e.enrollment_date DESC
  `).all(id);

  student.enrollments = enrollments;

  return c.json(student);
});

export default app;
