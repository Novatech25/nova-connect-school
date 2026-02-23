import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetQueries, expenseQueries } from '../queries/budget';
import type {
    CreateBudgetInput,
    UpdateBudgetInput,
    CreateExpenseInput,
    UpdateExpenseInput,
    BudgetFilters,
    ExpenseFilters,
} from '@novaconnect/core';

// ============================================================================
// BUDGETS HOOKS
// ============================================================================

/**
 * Hook to fetch all budgets with filters
 */
export function useBudgets(filters: BudgetFilters) {
    return useQuery({
        queryKey: ['budgets', filters],
        queryFn: () => budgetQueries.getAll(filters),
        enabled: !!filters.schoolId,
    });
}

/**
 * Hook to fetch a single budget
 */
export function useBudget(id: string) {
    return useQuery({
        queryKey: ['budget', id],
        queryFn: () => budgetQueries.getById(id),
        enabled: !!id,
    });
}

/**
 * Hook to create a budget
 */
export function useCreateBudget() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateBudgetInput) => budgetQueries.create(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
        },
    });
}

/**
 * Hook to update a budget
 */
export function useUpdateBudget() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput }) =>
            budgetQueries.update(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
        },
    });
}

/**
 * Hook to delete a budget
 */
export function useDeleteBudget() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => budgetQueries.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
        },
    });
}

// ============================================================================
// EXPENSES HOOKS
// ============================================================================

/**
 * Hook to fetch all expenses with filters
 */
export function useExpenses(filters: ExpenseFilters) {
    return useQuery({
        queryKey: ['expenses', filters],
        queryFn: () => expenseQueries.getAll(filters),
        enabled: !!filters.schoolId,
    });
}

/**
 * Hook to fetch a single expense
 */
export function useExpense(id: string) {
    return useQuery({
        queryKey: ['expense', id],
        queryFn: () => expenseQueries.getById(id),
        enabled: !!id,
    });
}

/**
 * Hook to create an expense
 */
export function useCreateExpense() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateExpenseInput) => expenseQueries.create(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
        },
    });
}

/**
 * Hook to update an expense
 */
export function useUpdateExpense() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateExpenseInput }) =>
            expenseQueries.update(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        },
    });
}

/**
 * Hook to delete an expense
 */
export function useDeleteExpense() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => expenseQueries.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
        },
    });
}

// ============================================================================
// COMPOSITE HOOKS
// ============================================================================

/**
 * Hook for budget dashboard
 */
export function useBudgetDashboard(schoolId: string, academicYearId: string) {
    const budgets = useBudgets({ schoolId, academicYearId });
    const expenses = useExpenses({ schoolId, academicYearId });

    return {
        budgets: budgets.data,
        expenses: expenses.data,
        isLoading: budgets.isLoading || expenses.isLoading,
        error: budgets.error || expenses.error,
    };
}
