import { getSupabaseClient } from '../client';
import { snakeToCamelKeys, camelToSnakeKeys } from '../helpers';
import type {
    Budget,
    Expense,
    CreateBudgetInput,
    UpdateBudgetInput,
    CreateExpenseInput,
    UpdateExpenseInput,
    BudgetFilters,
    ExpenseFilters,
} from '@novaconnect/core';

const supabase = getSupabaseClient();

// ============================================================================
// BUDGET QUERIES
// ============================================================================

export const budgetQueries = {
    /**
     * Fetch all budgets with optional filters
     */
    async getAll(filters: BudgetFilters): Promise<Budget[]> {
        let query = supabase
            .from('budgets')
            .select('*')
            .eq('school_id', filters.schoolId);

        if (filters.academicYearId) {
            query = query.eq('academic_year_id', filters.academicYearId);
        }

        if (filters.budgetType) {
            query = query.eq('budget_type', filters.budgetType);
        }

        if (filters.category) {
            query = query.eq('category', filters.category);
        }

        query = query.order('category', { ascending: true });

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    },

    /**
     * Fetch a single budget by ID
     */
    async getById(id: string): Promise<Budget | null> {
        const { data, error } = await supabase
            .from('budgets')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Create a new budget
     */
    async create(input: CreateBudgetInput): Promise<Budget> {
        const { data, error } = await supabase
            .from('budgets')
            .insert({
                school_id: input.schoolId,
                academic_year_id: input.academicYearId,
                category: input.category,
                allocated_amount: input.allocatedAmount,
                budget_type: input.budgetType || 'expense',
                description: input.description,
                created_by: input.createdBy,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update a budget
     */
    async update(id: string, input: UpdateBudgetInput): Promise<Budget> {
        const { data, error } = await supabase
            .from('budgets')
            .update({
                ...(input.category && { category: input.category }),
                ...(input.allocatedAmount !== undefined && { allocated_amount: input.allocatedAmount }),
                ...(input.budgetType && { budget_type: input.budgetType }),
                ...(input.description !== undefined && { description: input.description }),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a budget
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('budgets')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};

// ============================================================================
// EXPENSE QUERIES
// ============================================================================

export const expenseQueries = {
    /**
     * Fetch all expenses with optional filters
     */
    async getAll(filters: ExpenseFilters): Promise<Expense[]> {
        let query = supabase
            .from('expenses')
            .select('*')
            .eq('school_id', filters.schoolId);

        if (filters.academicYearId) {
            query = query.eq('academic_year_id', filters.academicYearId);
        }

        if (filters.budgetCategory) {
            query = query.eq('budget_category', filters.budgetCategory);
        }

        if (filters.budgetId) {
            query = query.eq('budget_id', filters.budgetId);
        }

        if (filters.startDate) {
            query = query.gte('expense_date', filters.startDate);
        }

        if (filters.endDate) {
            query = query.lte('expense_date', filters.endDate);
        }

        query = query.order('expense_date', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    },

    /**
     * Fetch a single expense by ID
     */
    async getById(id: string): Promise<Expense | null> {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Create a new expense
     */
    async create(input: CreateExpenseInput): Promise<Expense> {
        const { data, error } = await supabase
            .from('expenses')
            .insert({
                school_id: input.schoolId,
                academic_year_id: input.academicYearId,
                budget_id: input.budgetId,
                budget_category: input.budgetCategory,
                description: input.description,
                amount: input.amount,
                expense_date: input.expenseDate,
                payment_method: input.paymentMethod,
                reference_number: input.referenceNumber,
                notes: input.notes,
                created_by: input.createdBy,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update an expense
     */
    async update(id: string, input: UpdateExpenseInput): Promise<Expense> {
        const { data, error } = await supabase
            .from('expenses')
            .update({
                ...(input.budgetCategory && { budget_category: input.budgetCategory }),
                ...(input.description && { description: input.description }),
                ...(input.amount !== undefined && { amount: input.amount }),
                ...(input.expenseDate && { expense_date: input.expenseDate }),
                ...(input.paymentMethod !== undefined && { payment_method: input.paymentMethod }),
                ...(input.referenceNumber !== undefined && { reference_number: input.referenceNumber }),
                ...(input.notes !== undefined && { notes: input.notes }),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete an expense
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};
