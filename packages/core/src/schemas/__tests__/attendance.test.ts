import {
  attendanceStatusSchema,
  attendanceSourceSchema,
  attendanceSessionStatusSchema,
  createAttendanceSessionSchema,
  updateAttendanceSessionSchema,
  createAttendanceRecordSchema,
  updateAttendanceRecordSchema,
  bulkAttendanceRecordsSchema,
} from '../attendance';

describe('Attendance Schemas', () => {
  describe('Enums', () => {
    describe('attendanceStatusSchema', () => {
      it('should accept valid attendance statuses', () => {
        expect(attendanceStatusSchema.parse('present')).toBe('present');
        expect(attendanceStatusSchema.parse('absent')).toBe('absent');
        expect(attendanceStatusSchema.parse('late')).toBe('late');
        expect(attendanceStatusSchema.parse('excused')).toBe('excused');
      });

      it('should reject invalid attendance statuses', () => {
        expect(() => attendanceStatusSchema.parse('invalid')).toThrow();
      });
    });

    describe('attendanceSourceSchema', () => {
      it('should accept valid attendance sources', () => {
        expect(attendanceSourceSchema.parse('teacher_manual')).toBe('teacher_manual');
        expect(attendanceSourceSchema.parse('qr_scan')).toBe('qr_scan');
      });

      it('should reject invalid attendance sources', () => {
        expect(() => attendanceSourceSchema.parse('invalid')).toThrow();
      });
    });

    describe('attendanceSessionStatusSchema', () => {
      it('should accept valid session statuses', () => {
        expect(attendanceSessionStatusSchema.parse('draft')).toBe('draft');
        expect(attendanceSessionStatusSchema.parse('submitted')).toBe('submitted');
        expect(attendanceSessionStatusSchema.parse('validated')).toBe('validated');
      });

      it('should reject invalid session statuses', () => {
        expect(() => attendanceSessionStatusSchema.parse('invalid')).toThrow();
      });
    });
  });

  describe('Attendance Sessions', () => {
    describe('createAttendanceSessionSchema', () => {
      it('should accept valid input', () => {
        const validInput = {
          plannedSessionId: '123e4567-e89b-12d3-a456-426614174000',
          teacherId: '123e4567-e89b-12d3-a456-426614174001',
          classId: '123e4567-e89b-12d3-a456-426614174002',
          sessionDate: '2025-01-21',
          notes: 'Session notes',
        };

        const result = createAttendanceSessionSchema.parse(validInput);
        expect(result).toEqual(validInput);
      });

      it('should require all mandatory fields', () => {
        const invalidInput = {
          plannedSessionId: '123e4567-e89b-12d3-a456-426614174000',
          // Missing teacherId, classId, sessionDate
        };

        expect(() => createAttendanceSessionSchema.parse(invalidInput)).toThrow();
      });

      it('should require valid date format', () => {
        const invalidInput = {
          plannedSessionId: '123e4567-e89b-12d3-a456-426614174000',
          teacherId: '123e4567-e89b-12d3-a456-426614174001',
          classId: '123e4567-e89b-12d3-a456-426614174002',
          sessionDate: 'invalid-date',
        };

        expect(() => createAttendanceSessionSchema.parse(invalidInput)).toThrow();
      });

      it('should require valid UUID format', () => {
        const invalidInput = {
          plannedSessionId: 'not-a-uuid',
          teacherId: '123e4567-e89b-12d3-a456-426614174001',
          classId: '123e4567-e89b-12d3-a456-426614174002',
          sessionDate: '2025-01-21',
        };

        expect(() => createAttendanceSessionSchema.parse(invalidInput)).toThrow();
      });
    });

    describe('updateAttendanceSessionSchema', () => {
      it('should accept partial updates', () => {
        const updateInput = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'submitted' as const,
        };

        const result = updateAttendanceSessionSchema.parse(updateInput);
        expect(result).toEqual(updateInput);
      });

      it('should require id field', () => {
        const invalidInput = {
          status: 'submitted' as const,
        };

        expect(() => updateAttendanceSessionSchema.parse(invalidInput)).toThrow();
      });
    });
  });

  describe('Attendance Records', () => {
    describe('createAttendanceRecordSchema', () => {
      it('should accept valid input', () => {
        const validInput = {
          attendanceSessionId: '123e4567-e89b-12d3-a456-426614174000',
          studentId: '123e4567-e89b-12d3-a456-426614174001',
          status: 'present' as const,
        };

        const result = createAttendanceRecordSchema.parse(validInput);
        expect(result).toEqual(validInput);
      });

      it('should accept valid input with justification', () => {
        const validInput = {
          attendanceSessionId: '123e4567-e89b-12d3-a456-426614174000',
          studentId: '123e4567-e89b-12d3-a456-426614174001',
          status: 'excused' as const,
          justification: 'Medical certificate',
        };

        const result = createAttendanceRecordSchema.parse(validInput);
        expect(result).toEqual(validInput);
      });

      it('should require justification when status is excused', () => {
        const invalidInput = {
          attendanceSessionId: '123e4567-e89b-12d3-a456-426614174000',
          studentId: '123e4567-e89b-12d3-a456-426614174001',
          status: 'excused' as const,
          // Missing justification
        };

        expect(() => createAttendanceRecordSchema.parse(invalidInput)).toThrow();
      });

      it('should not require justification for other statuses', () => {
        const validInput = {
          attendanceSessionId: '123e4567-e89b-12d3-a456-426614174000',
          studentId: '123e4567-e89b-12d3-a456-426614174001',
          status: 'absent' as const,
        };

        expect(() => createAttendanceRecordSchema.parse(validInput)).not.toThrow();
      });
    });

    describe('updateAttendanceRecordSchema', () => {
      it('should accept partial updates', () => {
        const updateInput = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'late' as const,
        };

        const result = updateAttendanceRecordSchema.parse(updateInput);
        expect(result).toEqual(updateInput);
      });

      it('should require justification when updating status to excused', () => {
        const invalidInput = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'excused' as const,
          // Missing justification
        };

        expect(() => updateAttendanceRecordSchema.parse(invalidInput)).toThrow();
      });
    });

    describe('bulkAttendanceRecordsSchema', () => {
      it('should accept array of valid records', () => {
        const validInput = [
          {
            attendanceSessionId: '123e4567-e89b-12d3-a456-426614174000',
            studentId: '123e4567-e89b-12d3-a456-426614174001',
            status: 'present' as const,
          },
          {
            attendanceSessionId: '123e4567-e89b-12d3-a456-426614174000',
            studentId: '123e4567-e89b-12d3-a456-426614174002',
            status: 'absent' as const,
          },
        ];

        const result = bulkAttendanceRecordsSchema.parse(validInput);
        expect(result).toEqual(validInput);
      });

      it('should reject if any record is invalid', () => {
        const invalidInput = [
          {
            attendanceSessionId: '123e4567-e89b-12d3-a456-426614174000',
            studentId: '123e4567-e89b-12d3-a456-426614174001',
            status: 'excused' as const,
            // Missing justification
          },
        ];

        expect(() => bulkAttendanceRecordsSchema.parse(invalidInput)).toThrow();
      });
    });
  });
});
