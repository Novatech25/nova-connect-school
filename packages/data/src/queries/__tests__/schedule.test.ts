import { scheduleQueries } from '../schedule';
import { getSupabaseClient } from '../../client';

// Mock Supabase client
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockRpc = jest.fn();

const mockSupabase = {
  from: jest.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
  rpc: mockRpc,
};

// Chainable mocks
mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
mockInsert.mockReturnValue({ select: mockSelect });
mockUpdate.mockReturnValue({ eq: mockEq, select: mockSelect });
mockDelete.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ single: mockSingle });

jest.mock('../../client', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
}));

describe('scheduleQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should insert a new schedule with snake_case keys', async () => {
      const input = {
        schoolId: 'school-1',
        academicYearId: 'year-1',
        name: 'Test Schedule',
        description: 'Test Description',
        status: 'draft',
        version: 1,
      };

      const expectedResponse = {
        id: 'schedule-1',
        school_id: 'school-1',
        academic_year_id: 'year-1',
        name: 'Test Schedule',
        description: 'Test Description',
        status: 'draft',
        version: 1,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      mockSingle.mockResolvedValue({ data: expectedResponse, error: null });

      const result = await scheduleQueries.create().mutationFn(input);

      expect(getSupabaseClient).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('schedules');
      expect(mockInsert).toHaveBeenCalledWith({
        school_id: 'school-1',
        academic_year_id: 'year-1',
        name: 'Test Schedule',
        description: 'Test Description',
        status: 'draft',
        version: 1,
      });
      
      // Verify camelCase conversion in result
      expect(result).toEqual({
        id: 'schedule-1',
        schoolId: 'school-1',
        academicYearId: 'year-1',
        name: 'Test Schedule',
        description: 'Test Description',
        status: 'draft',
        version: 1,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      });
    });
  });

  describe('duplicate', () => {
    it('should call duplicate_schedule RPC', async () => {
      const input = {
        id: 'schedule-1',
        newName: 'Copy of Schedule',
      };

      mockRpc.mockResolvedValue({ 
        data: { id: 'schedule-2', name: 'Copy of Schedule' }, 
        error: null 
      });

      await scheduleQueries.duplicate().mutationFn(input);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('duplicate_schedule', {
        p_schedule_id: 'schedule-1',
        p_new_name: 'Copy of Schedule',
      });
    });
  });
});
