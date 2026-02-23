import { Database } from '../db/bun-sqlite.js';
import { generateStudentPaymentReceipt, generateTeacherSalaryReceipt, DEFAULT_CONFIGS } from './receiptTemplates';
import { generateVerificationToken, generateQRCodeDataUrl } from './receiptVerification';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export class ReceiptGeneratorService {
  constructor(private readonly db: Database) {}

  async generatePaymentReceipt(paymentId: string): Promise<string> {
    // Fetch payment from local DB
    const payment = this.db.prepare(
      `SELECT p.*, s.*, fs.*, ft.*, sch.*
       FROM payments p
       JOIN students s ON p.student_id = s.id
       JOIN fee_schedules fs ON p.fee_schedule_id = fs.id
       JOIN fee_types ft ON fs.fee_type_id = ft.id
       JOIN schools sch ON p.school_id = sch.id
       WHERE p.id = ?`
    ).get(paymentId) as any;

    if (!payment) throw new Error('Payment not found');

    // Generate receipt number
    const receiptNumber = await this.generateReceiptNumber(
      payment.school_id,
      'student_payment'
    );

    // Get printer profile
    const printerConfig = await this.getPrinterConfig(payment.school_id);

    // Generate verification token
    const verificationToken = generateVerificationToken(
      paymentId,
      'student_payment',
      payment.school_id
    );
    const qrDataUrl = await generateQRCodeDataUrl(verificationToken);

    // Generate PDF
    const receiptData = {
      school: payment,
      receiptNumber,
      date: new Date(payment.payment_date),
      amount: payment.amount,
      paymentMethod: payment.payment_method,
      student: payment,
      feeType: payment,
      feeSchedule: payment,
    };

    const pdfBlob = generateStudentPaymentReceipt(receiptData, printerConfig, qrDataUrl);

    // Save to local storage
    const fileName = `${payment.school_id}/${payment.student_id}/${receiptNumber}.pdf`;
    const filePath = path.join(process.env.STORAGE_PATH || './storage', 'receipts', fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, pdfBlob);

    // Save receipt record
    this.db.prepare(
      `INSERT INTO payment_receipts (id, school_id, payment_id, receipt_number, pdf_url, pdf_size_bytes, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), payment.school_id, paymentId, receiptNumber, fileName, pdfBlob.length, new Date().toISOString());

    // Queue for sync
    this.db.prepare(
      `INSERT INTO sync_queue (entity_type, entity_id, operation, data)
       VALUES (?, ?, ?, ?)`
    ).run('payment_receipt', paymentId, 'create', JSON.stringify({ receiptNumber, fileName }));

    return filePath;
  }

  async generatePayrollSlip(payrollEntryId: string): Promise<string> {
    // Fetch payroll entry from local DB
    const entry = this.db.prepare(
      `SELECT pe.*, u.*, pp.*, sch.*
       FROM payroll_entries pe
       JOIN users u ON pe.teacher_id = u.id
       JOIN payroll_periods pp ON pe.payroll_period_id = pp.id
       JOIN schools sch ON pe.school_id = sch.id
       WHERE pe.id = ?`
    ).get(payrollEntryId) as any;

    if (!entry) throw new Error('Payroll entry not found');

    // Fetch salary components
    const components = this.db.prepare(
      `SELECT * FROM salary_components WHERE payroll_entry_id = ?`
    ).all(payrollEntryId) as any[];

    // Generate slip number
    const slipNumber = await this.generateReceiptNumber(
      entry.school_id,
      'teacher_salary'
    );

    // Get printer profile
    const printerConfig = await this.getPrinterConfig(entry.school_id);

    // Generate verification token
    const verificationToken = generateVerificationToken(
      payrollEntryId,
      'teacher_salary',
      entry.school_id
    );
    const qrDataUrl = await generateQRCodeDataUrl(verificationToken);

    // Calculate amounts
    const primesAmount = components
      .filter((c: any) => c.component_type === 'prime')
      .reduce((sum: number, c: any) => sum + c.amount, 0);
    const retenuesAmount = components
      .filter((c: any) => c.component_type === 'retenue')
      .reduce((sum: number, c: any) => sum + c.amount, 0);
    const avancesAmount = components
      .filter((c: any) => c.component_type === 'avance')
      .reduce((sum: number, c: any) => sum + c.amount, 0);

    // Fetch cashier from most recent payment
    let cashier = null;
    const payments = this.db.prepare(
      `SELECT paid_by FROM payroll_payments
       WHERE payroll_entry_id = ?
       ORDER BY payment_date DESC
       LIMIT 1`
    ).get(payrollEntryId) as any;

    if (payments && payments.paid_by) {
      cashier = this.db.prepare(
        `SELECT id, first_name, last_name FROM users WHERE id = ?`
      ).get(payments.paid_by) as any;
    }

    // Generate PDF
    const receiptData = {
      school: entry,
      receiptNumber: slipNumber,
      date: new Date(entry.end_date),
      amount: entry.net_amount,
      paymentMethod: 'Virement',
      cashier,
      teacher: entry,
      payrollEntry: entry,
      salaryComponents: components || [],
      hoursWorked: entry.validated_hours,
      hourlyRate: entry.hourly_rate,
      grossAmount: entry.base_amount,
      primesAmount,
      retenuesAmount,
      avancesAmount,
    };

    const pdfBlob = generateTeacherSalaryReceipt(receiptData, printerConfig, qrDataUrl);

    // Save to local storage
    const fileName = `${entry.school_id}/${entry.teacher_id}/${slipNumber}.pdf`;
    const filePath = path.join(process.env.STORAGE_PATH || './storage', 'payroll-slips', fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, pdfBlob);

    // Save slip record
    this.db.prepare(
      `INSERT INTO payroll_slips (id, school_id, payroll_entry_id, slip_number, pdf_url, pdf_size_bytes, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), entry.school_id, payrollEntryId, slipNumber, fileName, pdfBlob.length, new Date().toISOString());

    // Queue for sync
    this.db.prepare(
      `INSERT INTO sync_queue (entity_type, entity_id, operation, data)
       VALUES (?, ?, ?, ?)`
    ).run('payroll_slip', payrollEntryId, 'create', JSON.stringify({ slipNumber, fileName }));

    return filePath;
  }

  private async generateReceiptNumber(schoolId: string, type: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = type === 'student_payment' ? 'SCH' : 'SAL';

    // Atomic increment
    const result = this.db.prepare(
      `INSERT INTO receipt_sequences (school_id, receipt_type, year, last_number, prefix)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT (school_id, receipt_type, year)
       DO UPDATE SET last_number = last_number + 1
       RETURNING last_number`
    ).get(schoolId, type, year, prefix) as any;

    const number = result.last_number;
    return `${prefix}-${year}-${String(number).padStart(7, '0')}`;
  }

  private async getPrinterConfig(schoolId: string): Promise<any> {
    const profile = this.db.prepare(
      `SELECT * FROM printer_profiles WHERE school_id = ? AND is_default = true LIMIT 1`
    ).get(schoolId) as any;

    if (profile) {
      return { ...DEFAULT_CONFIGS[profile.profile_type], ...profile.template_config };
    }

    return DEFAULT_CONFIGS.A4_STANDARD;
  }
}
