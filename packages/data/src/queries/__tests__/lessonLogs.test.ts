import { createLessonLog, validateGeolocation, approveLessonLog } from '../lessonLogs';
import { supabase } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

describe('lessonLogs queries', () => {
  describe('createLessonLog', () => {
    it('should create a lesson log', async () => {
      const mockLessonLog = {
        id: 'log-1',
        teacher_id: 'teacher-1',
        session_id: 'session-1',
        theme: 'Introduction to Algebra',
        content: 'Covered basic equations',
        homework: 'Exercises 1-10',
        status: 'draft',
      };

      (supabase as any).mockReturnValue({
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockLessonLog, error: null }),
            }),
          }),
        }),
      });

      const result = await createLessonLog({
        teacherId: 'teacher-1',
        sessionId: 'session-1',
        theme: 'Introduction to Algebra',
        content: 'Covered basic equations',
        homework: 'Exercises 1-10',
      });

      expect(result).toEqual(mockLessonLog);
    });

    it('should validate geolocation before saving', async () => {
      let geoValidated = false;

      (supabase as any).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'log-1' },
                error: null,
              }),
            }),
          }),
        }),
        rpc: jest.fn().mockImplementation(() => {
          geoValidated = true;
          return Promise.resolve({ data: { valid: true }, error: null });
        }),
      }));

      await createLessonLog({
        teacherId: 'teacher-1',
        sessionId: 'session-1',
        theme: 'Algebra',
        latitude: 5.360,
        longitude: -3.990,
        validateLocation: true,
      });

      expect(geoValidated).toBe(true);
    });
  });

  describe('validateGeolocation', () => {
    it('should validate location within school radius', async () => {
      (supabase as any).mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: { valid: true, distance: 50 }, // 50m from school
          error: null,
        }),
      });

      const result = await validateGeolocation({
        teacherId: 'teacher-1',
        latitude: 5.360,
        longitude: -3.990,
        schoolId: 'school-1',
      });

      expect(result.valid).toBe(true);
      expect(result.distance).toBe(50);
    });

    it('should reject location outside school radius', async () => {
      (supabase as any).mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: { valid: false, distance: 500 }, // 500m from school
          error: null,
        }),
      });

      const result = await validateGeolocation({
        teacherId: 'teacher-1',
        latitude: 5.370,
        longitude: -3.980,
        schoolId: 'school-1',
        maxRadius: 200, // 200m max
      });

      expect(result.valid).toBe(false);
      expect(result.distance).toBe(500);
    });

    it('should accept location if connected to school Wi-Fi', async () => {
      (supabase as any).mockReturnValue({
        rpc: jest.fn().mockResolvedValue({
          data: { valid: true, wifi: true },
          error: null,
        }),
      });

      const result = await validateGeolocation({
        teacherId: 'teacher-1',
        latitude: 5.370,
        longitude: -3.980,
        schoolId: 'school-1',
        wifiRequired: true,
        connectedWifiSSID: 'SCHOOL-WIFI',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('approveLessonLog', () => {
    it('should approve draft lesson log', async () => {
      (supabase as any).mockReturnValue({
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              data: [{ id: 'log-1', status: 'approved' }],
              error: null,
            }),
          }),
        }),
      });

      await expect(
        approveLessonLog({
          lessonLogId: 'log-1',
          approvedBy: 'admin-1',
        })
      ).resolves.not.toThrow();
    });

    it('should create audit log on approval', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          data: [{ id: 'log-1', status: 'approved' }],
          error: null,
        }),
      });

      (supabase as any).mockReturnValue({
        from: jest.fn().mockReturnValue({
          update: mockUpdate,
        }),
      });

      await approveLessonLog({
        lessonLogId: 'log-1',
        approvedBy: 'admin-1',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          approved_at: expect.any(String),
          approved_by: 'admin-1',
        })
      );
    });

    it('should allow only approved users to approve', async () => {
      (supabase as any).mockReturnValue({
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: { message: 'Permission denied' },
            }),
          }),
        }),
      });

      await expect(
        approveLessonLog({
          lessonLogId: 'log-1',
          approvedBy: 'teacher-1', // Teacher cannot approve
        })
      ).rejects.toThrow();
    });
  });
});
