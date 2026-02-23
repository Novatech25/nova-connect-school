import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollPeriodQueries, payrollEntryQueries, salaryComponentQueries, payrollPaymentQueries, payrollStatsQueries } from '../queries/payroll';
import type {
  CreatePayrollPeriodInput,
  UpdatePayrollEntryInput,
  CreateSalaryComponentInput,
  RecordPayrollPaymentInput,
  PayrollFilters,
} from '@core/schemas/payroll';

// ============================================================================
// PAYROLL PERIODS
// ============================================================================

export function usePayrollPeriods(schoolId: string, academicYearId?: string) {
  return useQuery({
    queryKey: ['payroll-periods', schoolId, academicYearId],
    queryFn: () => payrollPeriodQueries.getAll(schoolId, academicYearId),
    enabled: !!schoolId,
  });
}

export function usePayrollPeriod(id: string) {
  return useQuery({
    queryKey: ['payroll-period', id],
    queryFn: () => payrollPeriodQueries.getById(id),
    enabled: !!id,
  });
}

export function useCreatePayrollPeriod(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePayrollPeriodInput) => payrollPeriodQueries.create(schoolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods', schoolId] });
    },
  });
}

export function useDeletePayrollPeriod(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => payrollPeriodQueries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods', schoolId] });
    },
  });
}

// ============================================================================
// PAYROLL ENTRIES
// ============================================================================

export function usePayrollEntriesByPeriod(periodId: string) {
  return useQuery({
    queryKey: ['payroll-entries', 'period', periodId],
    queryFn: () => payrollEntryQueries.getByPeriod(periodId),
    enabled: !!periodId,
  });
}

export function usePayrollEntriesByTeacher(teacherId: string, filters?: PayrollFilters) {
  return useQuery({
    queryKey: ['payroll-entries', 'teacher', teacherId, filters],
    queryFn: () => payrollEntryQueries.getByTeacher(teacherId, filters),
    enabled: !!teacherId,
  });
}

export function usePayrollEntry(id: string) {
  return useQuery({
    queryKey: ['payroll-entry', id],
    queryFn: () => payrollEntryQueries.getById(id),
    enabled: !!id,
  });
}

export function useUpdatePayrollEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePayrollEntryInput) => payrollEntryQueries.update(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-entry', data.id] });
      queryClient.invalidateQueries({ queryKey: ['payroll-entries'] });
    },
  });
}

// ============================================================================
// SALARY COMPONENTS
// ============================================================================

export function useCreateSalaryComponent(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSalaryComponentInput) => salaryComponentQueries.create(schoolId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-entry', data.payrollEntryId] });
      queryClient.invalidateQueries({ queryKey: ['payroll-entries'] });
    },
  });
}

export function useDeleteSalaryComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => salaryComponentQueries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-entries'] });
    },
  });
}

// ============================================================================
// PAYROLL PAYMENTS
// ============================================================================

export function useRecordPayrollPayment(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordPayrollPaymentInput) => payrollPaymentQueries.record(schoolId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-entry', data.payrollEntryId] });
      queryClient.invalidateQueries({ queryKey: ['payroll-entries'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-payments'] });
    },
  });
}

export function usePayrollPaymentsByEntry(entryId: string) {
  return useQuery({
    queryKey: ['payroll-payments', 'entry', entryId],
    queryFn: () => payrollPaymentQueries.getByEntry(entryId),
    enabled: !!entryId,
  });
}

// ============================================================================
// STATS
// ============================================================================

export function useTeacherPayrollStats(teacherId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['payroll-stats', 'teacher', teacherId, startDate, endDate],
    queryFn: () => payrollStatsQueries.getTeacherStats(teacherId, startDate, endDate),
    enabled: !!teacherId && !!startDate && !!endDate,
  });
}

export function useTeacherHoursBreakdown(teacherId: string, periodId?: string) {
  return useQuery({
    queryKey: ['payroll-breakdown', teacherId, periodId],
    queryFn: () => payrollStatsQueries.getTeacherHoursBreakdown(teacherId, periodId),
    enabled: !!teacherId,
  });
}

export function useTeacherCurrentMonthEstimate(teacherId: string) {
  return useQuery({
    queryKey: ['payroll-estimate', teacherId],
    queryFn: () => payrollStatsQueries.getTeacherCurrentMonthHours(teacherId),
    enabled: !!teacherId,
  });
}
