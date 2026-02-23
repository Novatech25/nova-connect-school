import { describe, it, expect, beforeEach } from '@jest/globals';
import { gradeQueries } from '../grades';
import { getSupabaseClient } from '../client';

jest.mock('../client');

describe('grades queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('gradeQueries.create', () => {
    it('should create a single grade', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'grade-1',
                  student_id: 'student-1',
                  subject_id: 'subject-1',
                  score: 15,
                  coefficient: 1,
                  status: 'draft',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await gradeQueries.create({
        studentId: 'student-1',
        subjectId: 'subject-1',
        score: 15,
        coefficient: 1,
        trimester: 1,
      });

      expect(result).toEqual({
        id: 'grade-1',
        student_id: 'student-1',
        subject_id: 'subject-1',
        score: 15,
        coefficient: 1,
        status: 'draft',
      });
    });
  });

  describe('gradeQueries.createBulk', () => {
    it('should insert multiple grades in batch', async () => {
      const mockGrades = [
        { id: 'grade-1', student_id: 'student-1', subject_id: 'subject-1', score: 15, coefficient: 1 },
        { id: 'grade-2', student_id: 'student-2', subject_id: 'subject-1', score: 16, coefficient: 1 },
        { id: 'grade-3', student_id: 'student-3', subject_id: 'subject-1', score: 14, coefficient: 1 },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: mockGrades,
              error: null,
            }),
          }),
        }),
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await gradeQueries.createBulk({
        grades: [
          { studentId: 'student-1', subjectId: 'subject-1', score: 15, coefficient: 1, trimester: 1 },
          { studentId: 'student-2', subjectId: 'subject-1', score: 16, coefficient: 1, trimester: 1 },
          { studentId: 'student-3', subjectId: 'subject-1', score: 14, coefficient: 1, trimester: 1 },
        ],
      });

      expect(result).toHaveLength(3);
      expect(result[0].student_id).toBe('student-1');
    });

    it('should handle versioning for published grades', async () => {
      const mockGrades = [
        { id: 'grade-1', student_id: 'student-1', subject_id: 'subject-1', score: 15, coefficient: 1, version: 2 },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: mockGrades,
              error: null,
            }),
          }),
        }),
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await gradeQueries.createBulk({
        grades: [{ studentId: 'student-1', subjectId: 'subject-1', score: 15, coefficient: 1, trimester: 1 }],
      });

      expect(result[0].version).toBe(2);
    });
  });

  describe('gradeQueries.publish', () => {
    it('should publish approved grades', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

      await expect(
        gradeQueries.publish({
          gradeIds: ['grade-1', 'grade-2'],
          schoolId: 'school-1',
          userId: 'admin-1',
        })
      ).resolves.not.toThrow();
    });

    it('should create audit log on publish', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          update: mockUpdate,
        }),
        rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

      await gradeQueries.publish({
        gradeIds: ['grade-1', 'grade-2'],
        schoolId: 'school-1',
        userId: 'admin-1',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'published',
          published_at: expect.any(String),
          published_by: 'admin-1',
        })
      );
    });

    it('should send notifications to students and parents on publish', async () => {
      let notificationSent = false;

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                error: null,
              }),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              error: null,
              data: [{ id: 'notif-1' }],
            }),
          }),
        }),
        rpc: jest.fn().mockImplementation(() => {
          notificationSent = true;
          return Promise.resolve({ data: true, error: null });
        }),
      };

      (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

      await gradeQueries.publish({
        gradeIds: ['grade-1', 'grade-2'],
        schoolId: 'school-1',
        userId: 'admin-1',
      });

      expect(notificationSent).toBe(true);
    });
  });
});
