import { Hono } from 'hono';
import { randomUUID } from 'crypto';

const app = new Hono();

// Get license info
app.get('/license', (c) => {
  const licenseService = c.get('licenseService');
  const license = licenseService.getLicenseInfo();
  return c.json(license);
});

// Get sync statistics
app.get('/sync/stats', (c) => {
  const eventLog = c.get('eventLog');
  const stats = eventLog.getStats();
  return c.json(stats);
});

// Get recent events
app.get('/events', (c) => {
  const eventLog = c.get('eventLog');
  const limit = parseInt(c.req.query('limit') || '50');
  const events = eventLog.getRecentEvents(limit);
  return c.json(events);
});

// Trigger manual sync
app.post('/sync/trigger', async (c) => {
  const syncEngine = c.get('syncEngine');

  try {
    await syncEngine.syncNow();
    return c.json({ success: true, message: 'Sync completed' });
  } catch (error: any) {
    return c.json({ error: 'Sync failed', message: error.message }, 500);
  }
});

// Get gateway status
app.get('/status', (c) => {
  const db = c.get('db');
  const licenseService = c.get('licenseService');
  const syncEngine = c.get('syncEngine');
  const eventLog = c.get('eventLog');

  const license = licenseService.getLicenseInfo();
  const syncStatus = syncEngine.getStatus();
  const eventStats = eventLog.getStats();

  // Get database stats
  const tables = ['attendance_sessions', 'attendance_records', 'grades', 'lesson_logs', 'payments', 'schedules'];
  const tableStats: any = {};

  for (const table of tables) {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any;
    tableStats[table] = result.count;
  }

  return c.json({
    license: {
      schoolId: license?.school_id,
      status: license?.status,
      expiresAt: license?.expires_at,
      lastValidatedAt: license?.last_validated_at
    },
    sync: syncStatus,
    events: eventStats,
    tables: tableStats
  });
});

// Get health check
app.get('/health', (c) => {
  const db = c.get('db');
  const licenseService = c.get('licenseService');

  const isLicenseActive = licenseService.isLicenseActive();

  // Check database connection
  let dbStatus = 'ok';
  try {
    db.prepare('SELECT 1').get();
  } catch (error) {
    dbStatus = 'error';
  }

  return c.json({
    status: isLicenseActive ? 'healthy' : 'unhealthy',
    license: isLicenseActive ? 'active' : 'inactive',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Get configuration
app.get('/config', (c) => {
  const config = {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };

  return c.json(config);
});

// Get all students (sans auth pour les tests/dev)
app.get('/students', (c) => {
  const db = c.get('db');
  const schoolId = c.get('schoolId');

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

// Create student (sans auth pour les tests/dev)
app.post('/students', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  // Pour l'endpoint admin, on utilise le schoolId de l'environnement ou du corps de la requête
  let schoolId = c.get('schoolId');
  if (!schoolId) {
    schoolId = process.env.SCHOOL_ID;
  }
  const userId = c.get('userId');

  const payload = await c.req.json();

  const id = randomUUID();
  const matricule = payload.matricule || payload.matricule || '';
  const studentNumber = matricule || `LOCAL-${id.slice(0, 8)}`;
  const status = payload.status || payload.status || 'active';
  const isActive = status === 'active' ? 1 : 0;
  const now = new Date().toISOString();

  const dateOfBirth = payload.dateOfBirth || payload.date_of_birth;

  db.prepare(`
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
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    schoolId,
    payload.userId || payload.user_id || null,
    studentNumber,
    matricule || null,
    payload.firstName || payload.first_name,
    payload.lastName || payload.last_name,
    dateOfBirth,
    payload.gender || null,
    payload.placeOfBirth || payload.place_of_birth || null,
    payload.nationality || payload.nationality || null,
    payload.address || payload.address || null,
    payload.city || payload.city || null,
    payload.phone || payload.phone || null,
    payload.email || payload.email || null,
    payload.photoUrl || payload.photo_url || null,
    status,
    now,
    now
  );

  const eventData = {
    id,
    school_id: schoolId,
    student_number: studentNumber,
    matricule: matricule || null,
    first_name: payload.firstName || payload.first_name,
    last_name: payload.lastName || payload.last_name,
    date_of_birth: dateOfBirth,
    gender: payload.gender || null,
    place_of_birth: payload.placeOfBirth || payload.place_of_birth || null,
    nationality: payload.nationality || payload.nationality || null,
    address: payload.address || payload.address || null,
    city: payload.city || payload.city || null,
    phone: payload.phone || payload.phone || null,
    email: payload.email || payload.email || null,
    photo_url: payload.photoUrl || payload.photo_url || null,
    status,
    created_at: now,
    updated_at: now,
  };

  eventLog.addEvent(schoolId, 'create', 'students', id, eventData, userId);

  return c.json(eventData);
});

// Cleanup old events
app.post('/events/cleanup', async (c) => {
  const eventLog = c.get('eventLog');
  const daysToKeep = parseInt((await c.req.json()).days || '30');

  const count = eventLog.cleanup(daysToKeep);
  return c.json({
    success: true,
    message: `Cleaned up ${count} old events`,
    count
  });
});

export default app;
