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

const parseJson = (value: any) => {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

app.post('/', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const payload = await c.req.json();
  const id = randomUUID();
  const now = new Date().toISOString();
  const metadata = getValue(payload, 'metadata', 'metadata');

  db.prepare(
    `
      INSERT INTO parents (
        id,
        school_id,
        user_id,
        first_name,
        last_name,
        relationship,
        phone,
        email,
        address,
        city,
        occupation,
        workplace,
        is_primary_contact,
        is_emergency_contact,
        metadata,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    id,
    schoolId,
    getValue(payload, 'userId', 'user_id') || null,
    getValue(payload, 'firstName', 'first_name'),
    getValue(payload, 'lastName', 'last_name'),
    getValue(payload, 'relationship', 'relationship') || null,
    getValue(payload, 'phone', 'phone'),
    getValue(payload, 'email', 'email') || null,
    getValue(payload, 'address', 'address') || null,
    getValue(payload, 'city', 'city') || null,
    getValue(payload, 'occupation', 'occupation') || null,
    getValue(payload, 'workplace', 'workplace') || null,
    getValue(payload, 'isPrimaryContact', 'is_primary_contact') ? 1 : 0,
    getValue(payload, 'isEmergencyContact', 'is_emergency_contact') ? 1 : 0,
    toJsonString(metadata),
    now,
    now
  );

  const eventData = {
    id,
    school_id: schoolId,
    user_id: getValue(payload, 'userId', 'user_id') || null,
    first_name: getValue(payload, 'firstName', 'first_name'),
    last_name: getValue(payload, 'lastName', 'last_name'),
    relationship: getValue(payload, 'relationship', 'relationship') || null,
    phone: getValue(payload, 'phone', 'phone'),
    email: getValue(payload, 'email', 'email') || null,
    address: getValue(payload, 'address', 'address') || null,
    city: getValue(payload, 'city', 'city') || null,
    occupation: getValue(payload, 'occupation', 'occupation') || null,
    workplace: getValue(payload, 'workplace', 'workplace') || null,
    is_primary_contact: Boolean(getValue(payload, 'isPrimaryContact', 'is_primary_contact')),
    is_emergency_contact: Boolean(getValue(payload, 'isEmergencyContact', 'is_emergency_contact')),
    metadata: metadata || {},
    created_at: now,
    updated_at: now,
  };

  eventLog.addEvent(schoolId, 'create', 'parents', id, eventData, userId);

  return c.json(eventData);
});

app.get('/', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const studentId = c.req.query('studentId');

  if (studentId) {
    const rows = db.prepare(
      `
        SELECT
          spr.id AS relation_id,
          spr.relationship AS relation_relationship,
          spr.is_primary,
          spr.can_pickup,
          spr.can_view_grades,
          spr.can_view_attendance,
          p.id AS parent_id,
          p.school_id AS parent_school_id,
          p.user_id AS parent_user_id,
          p.first_name AS parent_first_name,
          p.last_name AS parent_last_name,
          p.relationship AS parent_relationship,
          p.phone AS parent_phone,
          p.email AS parent_email,
          p.address AS parent_address,
          p.city AS parent_city,
          p.occupation AS parent_occupation,
          p.workplace AS parent_workplace,
          p.is_primary_contact AS parent_is_primary_contact,
          p.is_emergency_contact AS parent_is_emergency_contact,
          p.metadata AS parent_metadata,
          p.created_at AS parent_created_at,
          p.updated_at AS parent_updated_at
        FROM student_parent_relations spr
        JOIN parents p ON p.id = spr.parent_id
        WHERE spr.school_id = ? AND spr.student_id = ?
        ORDER BY p.last_name, p.first_name
      `
    ).all(schoolId, studentId);

    const relations = rows.map((row: any) => ({
      id: row.relation_id,
      relationship: row.relation_relationship,
      is_primary: Boolean(row.is_primary),
      can_pickup: Boolean(row.can_pickup),
      can_view_grades: Boolean(row.can_view_grades),
      can_view_attendance: Boolean(row.can_view_attendance),
      parent: {
        id: row.parent_id,
        school_id: row.parent_school_id,
        user_id: row.parent_user_id,
        first_name: row.parent_first_name,
        last_name: row.parent_last_name,
        relationship: row.parent_relationship,
        phone: row.parent_phone,
        email: row.parent_email,
        address: row.parent_address,
        city: row.parent_city,
        occupation: row.parent_occupation,
        workplace: row.parent_workplace,
        is_primary_contact: Boolean(row.parent_is_primary_contact),
        is_emergency_contact: Boolean(row.parent_is_emergency_contact),
        metadata: parseJson(row.parent_metadata),
        created_at: row.parent_created_at,
        updated_at: row.parent_updated_at,
      },
    }));

    return c.json(relations);
  }

  const parents = db.prepare(
    'SELECT * FROM parents WHERE school_id = ? ORDER BY last_name, first_name'
  ).all(schoolId);

  return c.json(parents);
});

export default app;
