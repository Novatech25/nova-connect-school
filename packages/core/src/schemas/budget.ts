import { z } from 'zod';

// ============================================================================
// BUDGET SCHEMAS
// ============================================================================

export const budgetSchema = z.object({
    id: z.string().uuid(),
    schoolId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    category: z.string().min(1),
    allocatedAmount: z.number().nonnegative(),
    budgetType: z.enum(['revenue', 'expense']),
    description: z.string().optional().nullable(),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
    createdBy: z.string().uuid().optional().nullable(),
});

export const createBudgetSchema = z.object({
    schoolId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    category: z.string().min(1, 'La catégorie est requise'),
    allocatedAmount: z.number().positive('Le montant doit être positif'),
    budgetType: z.enum(['revenue', 'expense']).default('expense'),
    description: z.string().optional(),
    createdBy: z.string().uuid().optional(),
});

export const updateBudgetSchema = z.object({
    category: z.string().min(1).optional(),
    allocatedAmount: z.number().nonnegative().optional(),
    budgetType: z.enum(['revenue', 'expense']).optional(),
    description: z.string().optional().nullable(),
});

export const budgetFiltersSchema = z.object({
    schoolId: z.string().uuid(),
    academicYearId: z.string().uuid().optional(),
    budgetType: z.enum(['revenue', 'expense']).optional(),
    category: z.string().optional(),
});

// ============================================================================
// EXPENSE SCHEMAS
// ============================================================================

export const expenseSchema = z.object({
    id: z.string().uuid(),
    schoolId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    budgetId: z.string().uuid().optional().nullable(),
    budgetCategory: z.string().min(1),
    description: z.string().min(1),
    amount: z.number().positive(),
    expenseDate: z.string().or(z.date()),
    paymentMethod: z.string().optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
    createdBy: z.string().uuid().optional().nullable(),
});

export const createExpenseSchema = z.object({
    schoolId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    budgetId: z.string().uuid().optional(),
    budgetCategory: z.string().min(1, 'La catégorie budgétaire est requise'),
    description: z.string().min(1, 'La description est requise'),
    amount: z.number().positive('Le montant doit être positif'),
    expenseDate: z.string().or(z.date()),
    paymentMethod: z.string().optional(),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
    createdBy: z.string().uuid().optional(),
});

export const updateExpenseSchema = z.object({
    budgetCategory: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    amount: z.number().positive().optional(),
    expenseDate: z.string().or(z.date()).optional(),
    paymentMethod: z.string().optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

export const expenseFiltersSchema = z.object({
    schoolId: z.string().uuid(),
    academicYearId: z.string().uuid().optional(),
    budgetCategory: z.string().optional(),
    budgetId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

// ============================================================================
// TYPES
// ============================================================================

export type Budget = z.infer<typeof budgetSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type BudgetFilters = z.infer<typeof budgetFiltersSchema>;

export type Expense = z.infer<typeof expenseSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;
