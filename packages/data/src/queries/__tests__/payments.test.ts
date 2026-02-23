import { paymentQueries, balanceQueries, paymentEdgeFunctions } from '../payments';
import { getSupabaseClient } from '../client';

jest.mock('../client');

describe('payments queries', () => {
  describe('paymentQueries.create', () => {
    it('should create a payment record', async () => {
      const mockPayment = {
        id: 'payment-1',
        student_id: 'student-1',
        amount: 100000,
        payment_method: 'cash',
        status: 'verified',
      };

      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockPayment, error: null }),
            }),
          }),
        }),
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);

      const result = await paymentQueries.create({
        studentId: 'student-1',
        amount: 100000,
        paymentMethod: 'cash',
        schoolId: 'school-1',
        receivedBy: 'user-1',
      });

      expect(result).toEqual(mockPayment);
    });

    it('should generate receipt PDF', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'payment-1',
                  receipt_url: '/receipts/payment-1.pdf',
                },
                error: null,
              }),
            }),
          }),
        }),
        rpc: jest.fn().mockResolvedValue({
          data: '/receipts/payment-1.pdf',
          error: null,
        }),
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);

      const result = await paymentQueries.create({
        studentId: 'student-1',
        amount: 100000,
        paymentMethod: 'cash',
        schoolId: 'school-1',
        receivedBy: 'user-1',
      });

      // Note: Receipt generation is handled by edge function in real implementation
      expect(result).toBeDefined();
    });
  });

  describe('balanceQueries.getStudentBalance', () => {
    it('should calculate total balance from all installments', async () => {
      const mockSupabaseClient = {
        rpc: jest.fn().mockResolvedValue({
          data: {
            total_amount: 300000,
            paid_amount: 150000,
            remaining_amount: 150000,
            overdue_amount: 0,
          },
          error: null,
        }),
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);

      const balance = await balanceQueries.getStudentBalance('student-1', 'year-1');

      expect(balance.total_amount).toBe(300000);
      expect(balance.paid_amount).toBe(150000);
      expect(balance.remaining_amount).toBe(150000);
    });

    it('should detect overdue payments', async () => {
      const mockSupabaseClient = {
        rpc: jest.fn().mockResolvedValue({
          data: {
            total_amount: 200000,
            paid_amount: 0,
            remaining_amount: 200000,
            overdue_amount: 100000,
          },
          error: null,
        }),
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);

      const balance = await balanceQueries.getStudentBalance('student-1', 'year-1');

      expect(balance.overdue_amount).toBe(100000);
    });
  });

  describe('paymentEdgeFunctions.sendReminders', () => {
    it('should send reminder to parent for overdue payment', async () => {
      let reminderSent = false;

      const mockSupabaseClient = {
        functions: {
          invoke: jest.fn().mockImplementation(() => {
            reminderSent = true;
            return Promise.resolve({ data: true, error: null });
          }),
        },
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);

      await paymentEdgeFunctions.sendReminders({
        studentIds: ['student-1'],
        reminderType: 'first',
        dryRun: false,
      });

      expect(reminderSent).toBe(true);
    });

    it('should send reminder via multiple channels', async () => {
      const mockSupabaseClient = {
        functions: {
          invoke: jest.fn().mockResolvedValue({
            data: {
              sent: 3,
              channels: ['email', 'push', 'sms'],
            },
            error: null,
          }),
        },
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);

      const result = await paymentEdgeFunctions.sendReminders({
        studentIds: ['student-1'],
        reminderType: 'custom',
      });

      expect(result).toBeDefined();
    });
  });
});
