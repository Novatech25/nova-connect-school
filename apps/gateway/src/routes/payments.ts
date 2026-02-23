import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { getSchoolId, getUserId } from '../middleware/rls.js';

const app = new Hono();

// Create payment
app.post('/', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const {
    studentId,
    paymentType,
    amount,
    paymentDate,
    paymentMethod,
    reference,
    receiptNumber,
    notes
  } = await c.req.json();

  const id = randomUUID();

  db.prepare(`
    INSERT INTO payments (
      id, school_id, student_id, payment_type, amount, payment_date,
      payment_method, reference, receipt_number, status, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    schoolId,
    studentId,
    paymentType,
    amount,
    paymentDate,
    paymentMethod,
    reference || null,
    receiptNumber || null,
    'completed',
    notes || null
  );

  // Add to event log
  eventLog.addEvent(schoolId, 'create', 'payments', id, {
    id,
    school_id: schoolId,
    student_id: studentId,
    payment_type: paymentType,
    amount,
    payment_date: paymentDate,
    payment_method: paymentMethod,
    reference: reference || null,
    receipt_number: receiptNumber || null,
    status: 'completed',
    notes: notes || null
  }, userId);

  return c.json({ id, success: true });
});

// Update payment
app.patch('/:id', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const paymentId = c.req.param('id');
  const { amount, paymentMethod, reference, receiptNumber, status, notes } = await c.req.json();

  const updateData: any = {};
  if (amount !== undefined) updateData.amount = amount;
  if (paymentMethod !== undefined) updateData.payment_method = paymentMethod;
  if (reference !== undefined) updateData.reference = reference;
  if (receiptNumber !== undefined) updateData.receipt_number = receiptNumber;
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;

  const setClause = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updateData);

  db.prepare(`
    UPDATE payments
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ? AND school_id = ?
  `).run(...values, paymentId, schoolId);

  eventLog.addEvent(schoolId, 'update', 'payments', paymentId, updateData, userId);

  return c.json({ success: true });
});

// Get payments by student
app.get('/student/:studentId', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const studentId = c.req.param('studentId');
  const paymentType = c.req.query('paymentType');
  const status = c.req.query('status');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  let query = 'SELECT * FROM payments WHERE school_id = ? AND student_id = ?';
  const params: any[] = [schoolId, studentId];

  if (paymentType) {
    query += ' AND payment_type = ?';
    params.push(paymentType);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (startDate) {
    query += ' AND payment_date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND payment_date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY payment_date DESC';

  const payments = db.prepare(query).all(...params);
  return c.json(payments);
});

// Get payments by school (paginated)
app.get('/', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const paymentType = c.req.query('paymentType');
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  let query = 'SELECT * FROM payments WHERE school_id = ?';
  const params: any[] = [schoolId];

  if (paymentType) {
    query += ' AND payment_type = ?';
    params.push(paymentType);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY payment_date DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const payments = db.prepare(query).all(...params);
  return c.json(payments);
});

// Get payment by ID
app.get('/:id', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const paymentId = c.req.param('id');

  const payment = db.prepare(
    'SELECT * FROM payments WHERE id = ? AND school_id = ?'
  ).get(paymentId, schoolId);

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  return c.json(payment);
});

// Get payment summary by student
app.get('/student/:studentId/summary', async (c) => {
  const db = c.get('db');
  const schoolId = getSchoolId(c);
  const studentId = c.req.param('studentId');
  const paymentType = c.req.query('paymentType');

  let query = `
    SELECT
      payment_type,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM payments
    WHERE school_id = ? AND student_id = ?
  `;
  const params: any[] = [schoolId, studentId];

  if (paymentType) {
    query += ' AND payment_type = ?';
    params.push(paymentType);
  }

  query += ' GROUP BY payment_type';

  const summary = db.prepare(query).all(...params);
  return c.json(summary);
});

// Delete payment (should be rare, but needed for corrections)
app.delete('/:id', async (c) => {
  const db = c.get('db');
  const eventLog = c.get('eventLog');
  const schoolId = getSchoolId(c);
  const userId = getUserId(c);

  const paymentId = c.req.param('id');

  // Check if payment exists
  const payment = db.prepare(
    'SELECT id FROM payments WHERE id = ? AND school_id = ?'
  ).get(paymentId, schoolId);

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  db.prepare('DELETE FROM payments WHERE id = ? AND school_id = ?').run(paymentId, schoolId);

  eventLog.addEvent(schoolId, 'delete', 'payments', paymentId, {
    id: paymentId
  }, userId);

  return c.json({ success: true });
});

export default app;
