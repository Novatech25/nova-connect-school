import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  campusQueries,
  userCampusAccessQueries,
  classCampusQueries,
  sessionCampusQueries,
  campusScheduleQueries,
  campusStatisticsQueries,
  getAccessibleCampuses,
  checkUserCampusAccess,
  checkMultiCampusEnabled,
} from '../multiCampus';
import { getSupabaseClient } from '../client';

// Mock Supabase client
vi.mock('../client', () => ({
  getSupabaseClient(): {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            single: vi.fn(),
            maybeSingle: vi.fn(),
          })),
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(),
            })),
          })),
          single: vi.fn(),
        })),
        single: vi.fn(),
        order: vi.fn(),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
    })),
    rpc: vi.fn(),
  },
}));

describe('Campus Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('campusQueries.getBySchool', () => {
    it('should fetch all campuses for a school', async () => {
      const mockCampuses = [
        {
          id: 'campus-1',
          school_id: 'school-1',
          name: 'Campus Principal',
          code: 'MAIN',
          is_main: true,
        },
        {
          id: 'campus-2',
          school_id: 'school-1',
          name: 'Campus Nord',
          code: 'NORTH',
          is_main: false,
        },
      ];

      const mockFrom = vi.fn();
      const mockSelect = vi.fn();
      const mockEq = vi.fn();
      const mockOrder = vi.fn();

      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ order: mockOrder });
      mockOrder.mockResolvedValue({ data: mockCampuses, error: null });

      // Setup getSupabaseClient().from mock
      (getSupabaseClient().from as any).mockImplementation((table: string) => {
        if (table === 'campuses') {
          return { select: mockSelect };
        }
        return vi.fn();
      });

      const query = campusQueries.getBySchool('school-1');
      const result = await query.queryFn();

      expect(result).toEqual(mockCampuses);
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('school_id', 'school-1');
    });

    it('should order by is_main first, then by name', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      (getSupabaseClient().from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: mockOrder,
          }),
        }),
      });

      const query = campusQueries.getBySchool('school-1');
      await query.queryFn();

      expect(mockOrder).toHaveBeenCalledWith('is_main', { ascending: false });
      expect(mockOrder).toHaveBeenCalledWith('name');
    });
  });

  describe('campusQueries.getById', () => {
    it('should fetch campus by ID', async () => {
      const mockCampus = {
        id: 'campus-1',
        name: 'Campus Principal',
        code: 'MAIN',
      };

      (getSupabaseClient().from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockCampus,
              error: null,
            }),
          }),
        }),
      });

      const query = campusQueries.getById('campus-1');
      const result = await query.queryFn();

      expect(result).toEqual(mockCampus);
    });
  });
});

describe('User Campus Access Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('userCampusAccessQueries.getByUser', () => {
    it('should fetch user campus access with campus details', async () => {
      const mockAccess = [
        {
          id: 'access-1',
          user_id: 'user-1',
          campus_id: 'campus-1',
          access_type: 'full_access',
          can_access: true,
          campus: {
            id: 'campus-1',
            name: 'Campus Principal',
          },
        },
      ];

      (getSupabaseClient().from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockAccess,
            error: null,
          }),
        }),
      });

      const query = userCampusAccessQueries.getByUser('user-1', 'school-1');
      const result = await query.queryFn();

      expect(result).toEqual(mockAccess);
      expect((getSupabaseClient().from as any).mock.calls[0][0]).toBe('user_campus_access');
    });
  });

  describe('userCampusAccessQueries.assign', () => {
    it('should assign user to campus', async () => {
      const mockAccess = {
        id: 'access-1',
        user_id: 'user-1',
        campus_id: 'campus-1',
        access_type: 'full_access',
        can_access: true,
      };

      (getSupabaseClient().from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockAccess,
              error: null,
            }),
          }),
        }),
      });

      const mutation = userCampusAccessQueries.assign();
      const result = await mutation.mutationFn({
        schoolId: 'school-1',
        userId: 'user-1',
        campusId: 'campus-1',
        accessType: 'full_access',
        canAccess: true,
      });

      expect(result).toEqual(mockAccess);
      expect((getSupabaseClient().from as any).mock.calls[0][0]).toBe('user_campus_access');
    });
  });

  describe('userCampusAccessQueries.revoke', () => {
    it('should revoke user campus access', async () => {
      const mockAccess = {
        id: 'access-1',
      };

      (getSupabaseClient().from as any).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAccess,
                error: null,
              }),
            }),
          }),
        }),
      });

      const mutation = userCampusAccessQueries.revoke();
      const result = await mutation.mutationFn({
        userId: 'user-1',
        campusId: 'campus-1',
      });

      expect(result).toEqual(mockAccess);
    });
  });
});

describe('Class Campus Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classCampusQueries.updateCampus', () => {
    it('should update class campus', async () => {
      const mockClass = {
        id: 'class-1',
        name: 'Class A',
        campus_id: 'campus-1',
      };

      (getSupabaseClient().from as any).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockClass,
                error: null,
              }),
            }),
          }),
        }),
      });

      const mutation = classCampusQueries.updateCampus();
      const result = await mutation.mutationFn({
        classId: 'class-1',
        campusId: 'campus-1',
      });

      expect(result).toEqual(mockClass);
      expect((getSupabaseClient().from as any).mock.calls[0][0]).toBe('classes');
    });
  });
});

describe('Session Campus Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sessionCampusQueries.getByCampus', () => {
    it('should fetch sessions for campus within date range', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          campus_id: 'campus-1',
          session_date: '2025-01-21',
          start_time: '08:00',
          end_time: '10:00',
          class: { name: 'Class A' },
          teacher: { first_name: 'John', last_name: 'Doe' },
        },
      ];

      (getSupabaseClient().from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockSessions,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const query = sessionCampusQueries.getByCampus(
        'campus-1',
        '2025-01-01',
        '2025-01-31'
      );
      const result = await query.queryFn();

      expect(result).toEqual(mockSessions);
    });
  });
});

describe('Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAccessibleCampuses', () => {
    it('should fetch accessible campuses via RPC', async () => {
      const mockCampuses = [
        {
          id: 'campus-1',
          name: 'Campus Principal',
          code: 'MAIN',
        },
      ];

      (getSupabaseClient().rpc as any).mockResolvedValue({
        data: mockCampuses,
        error: null,
      });

      const result = await getAccessibleCampuses('user-1');

      expect(result).toEqual(mockCampuses);
      expect(getSupabaseClient().rpc).toHaveBeenCalledWith('get_accessible_campuses', {
        p_user_id: 'user-1',
      });
    });
  });

  describe('checkUserCampusAccess', () => {
    it('should check user access via RPC', async () => {
      (getSupabaseClient().rpc as any).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await checkUserCampusAccess('user-1', 'campus-1');

      expect(result).toBe(true);
      expect(getSupabaseClient().rpc).toHaveBeenCalledWith('check_user_campus_access', {
        p_user_id: 'user-1',
        p_campus_id: 'campus-1',
      });
    });
  });

  describe('checkMultiCampusEnabled', () => {
    it('should check if multi-campus is enabled', async () => {
      (getSupabaseClient().rpc as any).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await checkMultiCampusEnabled('school-1');

      expect(result).toBe(true);
      expect(getSupabaseClient().rpc).toHaveBeenCalledWith('check_multi_campus_enabled', {
        p_school_id: 'school-1',
      });
    });
  });
});
