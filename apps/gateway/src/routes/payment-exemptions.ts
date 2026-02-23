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
  const now = new Date().toISOString();

  const exemptionType = getValue(payload, 'exemptionType', 'exemption_type');
  const amount = getValue(payload, 'amount', 'amount');
  const percentage = getValue(payload, 'percentage', 'percentage');
  const reason = getValue(payload, 'reason', 'reason');
  const validFrom = getValue(payload, 'validFrom', 'valid_from');
  const validUntil = getValue(payload, 'validUntil', 'valid_until');
  const appliesToFeeTypes = getValue(payload, 'appliesToFeeTypes', 'applies_to_fee_types');
  const metadata = getValue(payload, 'metadata', 'metadata');

  db.prepare(
    `
      INSERT INTO payment_exemptions (
        id,
        school_id,
        student_id,
        exemption_type,
        amount,
        percentage,
        reason,
        approved_by,
        approved_at,
        valid_from,
        valid_until,
        applies_to_fee_types,
        is_active,
        metadata,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    id,
    schoolId,
    getValue(payload, 'studentId', 'student_id'),
    exemptionType,
    amount ?? null,
    percentage ?? null,
    reason,
    userId || getValue(payload, 'approvedBy', 'approved_by') || null,
    now,
    validFrom,
    validUntil || null,
    toJsonString(appliesToFeeTypes) || '[]',
    1,
    toJsonString(metadata),
    now,
    now
  );

  const eventData = {
    id,
    school_id: schoolId,
    student_id: getValue(payload, 'studentId', 'student_id'),
    exemption_type: exemptionType,
    amount: amount ?? null,
    percentage: percentage ?? null,
    reason,
    approved_by: userId || getValue(payload, 'approvedBy', 'approved_by') || null,
    approved_at: now,
    valid_from: validFrom,
    valid_until: validUntil || null,
    applies_to_fee_types: appliesToFeeTypes || [],
    is_active: true,
    metadata: metadata || {},
    created_at: now,
    updated_at: now,
  };

  eventLog.addEvent(schoolId, 'create', 'payment_exemptions', id, eventData, userId);

  return c.json(eventData);
});

export default app;
