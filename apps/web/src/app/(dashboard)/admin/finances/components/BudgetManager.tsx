'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash, AlertTriangle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { usePayments, useAcademicYears } from '@novaconnect/data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Budget {
    id: string;
    category: string;
    allocated: number;
    type: 'revenue' | 'expense';
}

interface Expense {
    id: string;
    budgetCategory: string;
    description: string;
    amount: number;
    date: string;
}

interface BudgetManagerProps {
    schoolId: string;
    academicYearId: string;
}

const formatCurrency = (value: number) => {
    return `${Math.round(value).toLocaleString('fr-FR')} FCFA`;
};

const formatDate = (value?: string | Date | null) => {
    if (!value) return '--';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('fr-FR');
};

const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export function BudgetManager({ schoolId, academicYearId }: BudgetManagerProps) {
    const { data: payments = [] } = usePayments({ schoolId, academicYearId } as any);
    const { data: academicYears = [] } = useAcademicYears(schoolId);

    // Récupérer l'année scolaire courante et ses dates
    const currentYear = useMemo(() => {
        return academicYears.find((y: any) => y.id === academicYearId);
    }, [academicYears, academicYearId]);

    const yearStartDate = currentYear?.start_date || currentYear?.startDate;
    const yearEndDate = currentYear?.end_date || currentYear?.endDate;

    // États pour les budgets et dépenses
    const [budgets, setBudgets] = useState<Budget[]>([
        { id: '1', category: 'Salaires Enseignants', allocated: 50000000, type: 'expense' },
        { id: '2', category: 'Fournitures Scolaires', allocated: 10000000, type: 'expense' },
        { id: '3', category: 'Infrastructure', allocated: 20000000, type: 'expense' },
        { id: '4', category: 'Électricité et Eau', allocated: 5000000, type: 'expense' },
        { id: '5', category: 'Maintenance', allocated: 3000000, type: 'expense' },
        { id: '6', category: 'Transport Scolaire', allocated: 8000000, type: 'expense' },
    ]);

    // Générer des dépenses mockées basées sur l'année scolaire pour rendre le filtrage visible
    const generateMockExpenses = useMemo(() => {
        if (!yearStartDate || !yearEndDate) {
            // Utiliser des dates de l'année en cours si pas d'année scolaire
            const today = new Date();
            return [
                { id: '1', budgetCategory: 'Salaires Enseignants', description: 'Salaires Janvier', amount: 4200000, date: `${today.getFullYear()}-01-31` },
                { id: '2', budgetCategory: 'Fournitures Scolaires', description: 'Cahiers et stylos', amount: 850000, date: `${today.getFullYear()}-02-05` },
                { id: '3', budgetCategory: 'Électricité et Eau', description: 'Facture Janvier', amount: 420000, date: `${today.getFullYear()}-02-01` },
                { id: '4', budgetCategory: 'Infrastructure', description: 'Réparation toiture', amount: 2500000, date: `${today.getFullYear()}-02-10` },
                { id: '5', budgetCategory: 'Salaires Enseignants', description: 'Salaires Février', amount: 4200000, date: `${today.getFullYear()}-02-28` },
            ];
        }

        // Générer des dépenses dans la plage de l'année scolaire
        const startDate = new Date(yearStartDate);
        const yearStr = startDate.getFullYear();
        const monthStr = String(startDate.getMonth() + 1).padStart(2, '0');
        const nextMonthDate = new Date(startDate);
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const nextMonthStr = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
        const nextYearStr = nextMonthDate.getFullYear();

        return [
            { id: '1', budgetCategory: 'Salaires Enseignants', description: 'Salaires du mois', amount: 4200000, date: `${yearStr}-${monthStr}-28` },
            { id: '2', budgetCategory: 'Fournitures Scolaires', description: 'Cahiers et stylos', amount: 850000, date: `${yearStr}-${monthStr}-15` },
            { id: '3', budgetCategory: 'Électricité et Eau', description: `Facture ${monthStr}/${yearStr}`, amount: 420000, date: `${yearStr}-${monthStr}-10` },
            { id: '4', budgetCategory: 'Infrastructure', description: 'Réparation toiture', amount: 2500000, date: `${yearStr}-${monthStr}-20` },
            { id: '5', budgetCategory: 'Salaires Enseignants', description: 'Salaires mois suivant', amount: 4200000, date: `${nextYearStr}-${nextMonthStr}-28` },
            { id: '6', budgetCategory: 'Maintenance', description: 'Entretien matériel', amount: 350000, date: `${nextYearStr}-${nextMonthStr}-12` },
        ];
    }, [yearStartDate, yearEndDate]);

    const [allExpenses, setAllExpenses] = useState<Expense[]>(generateMockExpenses);

    const [isAddingBudget, setIsAddingBudget] = useState(false);
    const [isAddingExpense, setIsAddingExpense] = useState(false);
    const [newBudget, setNewBudget] = useState({ category: '', allocated: 0, type: 'expense' as 'revenue' | 'expense' });
    const [newExpense, setNewExpense] = useState({ budgetCategory: '', description: '', amount: 0, date: getTodayString() });

    // Mettre à jour les dépenses mockées quand l'année scolaire change
    useMemo(() => {
        setAllExpenses(generateMockExpenses);
    }, [generateMockExpenses]);

    // Filtrer les dépenses par année scolaire
    const expenses = useMemo(() => {
        if (!yearStartDate || !yearEndDate) return allExpenses;

        const startDate = new Date(yearStartDate);
        const endDate = new Date(yearEndDate);

        const filtered = allExpenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= startDate && expenseDate <= endDate;
        });

        console.log('💰 Budget Manager - Filtrage:', {
            yearStartDate,
            yearEndDate,
            totalExpenses: allExpenses.length,
            filteredExpenses: filtered.length,
            expenses: filtered,
        });

        return filtered;
    }, [allExpenses, yearStartDate, yearEndDate]);

    // Calculs basés sur données réelles
    const totalRevenue = useMemo(() => {
        return payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    }, [payments]);

    const totalExpenses = useMemo(() => {
        return expenses.reduce((sum, e) => sum + e.amount, 0);
    }, [expenses]);

    const totalBudgeted = useMemo(() => {
        return budgets.filter(b => b.type === 'expense').reduce((sum, b) => sum + b.allocated, 0);
    }, [budgets]);

    const netBalance = totalRevenue - totalExpenses;
    const budgetUtilization = totalBudgeted > 0 ? (totalExpenses / totalBudgeted) * 100 : 0;

    // Calcul des dépenses par catégorie
    const categoryExpenses = useMemo(() => {
        const result: Record<string, number> = {};
        expenses.forEach(expense => {
            result[expense.budgetCategory] = (result[expense.budgetCategory] || 0) + expense.amount;
        });
        return result;
    }, [expenses]);

    const getProgressPercent = (spent: number, allocated: number) => {
        return allocated > 0 ? (spent / allocated) * 100 : 0;
    };

    const getProgressColor = (percent: number) => {
        if (percent >= 90) return 'bg-red-500';
        if (percent >= 75) return 'bg-orange-500';
        if (percent >= 50) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const handleAddBudget = () => {
        if (!newBudget.category || newBudget.allocated <= 0) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        const budget: Budget = {
            id: Date.now().toString(),
            category: newBudget.category,
            allocated: newBudget.allocated,
            type: newBudget.type,
        };

        setBudgets([...budgets, budget]);
        setNewBudget({ category: '', allocated: 0, type: 'expense' });
        setIsAddingBudget(false);
    };

    const handleAddExpense = () => {
        if (!newExpense.budgetCategory || !newExpense.description || newExpense.amount <= 0) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        const expense: Expense = {
            id: Date.now().toString(),
            budgetCategory: newExpense.budgetCategory,
            description: newExpense.description,
            amount: newExpense.amount,
            date: newExpense.date,
        };

        setAllExpenses([...allExpenses, expense]);
        setNewExpense({ budgetCategory: '', description: '', amount: 0, date: getTodayString() });
        setIsAddingExpense(false);
    };

    const handleDeleteBudget = (id: string) => {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce budget ?')) {
            setBudgets(budgets.filter(b => b.id !== id));
        }
    };

    const handleDeleteExpense = (id: string) => {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
            setAllExpenses(allExpenses.filter(e => e.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            {/* KPIs Principaux */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            Revenus Collectés
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(totalRevenue)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {payments.length} paiements
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-orange-600" />
                            Dépenses Totales
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-orange-600">
                            {formatCurrency(totalExpenses)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {expenses.length} transactions
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                            Solde Net
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatCurrency(netBalance)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Revenus - Dépenses
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-700">
                            Utilisation Budget
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${budgetUtilization >= 90 ? 'text-red-600' : budgetUtilization >= 75 ? 'text-orange-600' : 'text-green-600'}`}>
                            {budgetUtilization.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {formatCurrency(totalExpenses)} / {formatCurrency(totalBudgeted)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Budgets par Catégorie */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Budgets par Catégorie</CardTitle>
                        <Button onClick={() => setIsAddingBudget(true)} size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Ajouter Budget
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Catégorie</TableHead>
                                <TableHead className="text-right">Budget Alloué</TableHead>
                                <TableHead className="text-right">Dépensé</TableHead>
                                <TableHead className="text-right">Restant</TableHead>
                                <TableHead>Progression</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {budgets.filter(b => b.type === 'expense').map((budget) => {
                                const spent = categoryExpenses[budget.category] || 0;
                                const remaining = budget.allocated - spent;
                                const progress = getProgressPercent(spent, budget.allocated);
                                const isOverBudget = spent > budget.allocated;

                                return (
                                    <TableRow key={budget.id}>
                                        <TableCell className="font-medium">{budget.category}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(budget.allocated)}</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(spent)}</TableCell>
                                        <TableCell className="text-right">
                                            <span className={isOverBudget ? 'text-red-600 font-bold' : 'text-green-600'}>
                                                {formatCurrency(remaining)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[100px]">
                                                    <div
                                                        className={`h-2 rounded-full transition-all ${getProgressColor(progress)}`}
                                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium min-w-[50px] text-right">
                                                    {progress.toFixed(1)}%
                                                </span>
                                                {progress >= 90 && (
                                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteBudget(budget.id)}
                                                >
                                                    <Trash className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {budgets.filter(b => b.type === 'expense').length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-gray-500 py-6">
                                        Aucun budget défini. Cliquez sur "Ajouter Budget" pour commencer.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Dépenses Récentes */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Dépenses Récentes</CardTitle>
                        <Button onClick={() => setIsAddingExpense(true)} size="sm" variant="outline">
                            <Plus className="w-4 h-4 mr-2" />
                            Enregistrer Dépense
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Catégorie</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Montant</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expenses.slice().reverse().slice(0, 10).map((expense) => (
                                <TableRow key={expense.id}>
                                    <TableCell>{formatDate(expense.date)}</TableCell>
                                    <TableCell className="font-medium">{expense.budgetCategory}</TableCell>
                                    <TableCell>{expense.description}</TableCell>
                                    <TableCell className="text-right font-semibold text-orange-600">
                                        {formatCurrency(expense.amount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteExpense(expense.id)}
                                        >
                                            <Trash className="w-4 h-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {expenses.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                                        Aucune dépense enregistrée pour cette année scolaire.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Alertes Budgétaires */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Alertes Budgétaires
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {budgets
                            .filter(b => b.type === 'expense')
                            .map(budget => ({
                                ...budget,
                                spent: categoryExpenses[budget.category] || 0,
                            }))
                            .filter(b => getProgressPercent(b.spent, b.allocated) >= 75)
                            .map(budget => {
                                const progress = getProgressPercent(budget.spent, budget.allocated);
                                return (
                                    <div
                                        key={budget.id}
                                        className={`p-4 rounded-lg border-l-4 ${progress >= 90
                                            ? 'bg-red-50 border-red-500'
                                            : 'bg-orange-50 border-orange-500'
                                            }`}
                                    >
                                        <p className="font-medium">
                                            {budget.category}: {progress.toFixed(1)}% du budget utilisé
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {progress >= 90
                                                ? '⚠️ Limite critique atteinte - Action immédiate requise'
                                                : '⚠️ Approche de la limite budgétaire'}
                                        </p>
                                    </div>
                                );
                            })}
                        {budgets
                            .filter(b => b.type === 'expense')
                            .map(budget => ({
                                ...budget,
                                spent: categoryExpenses[budget.category] || 0,
                            }))
                            .filter(b => getProgressPercent(b.spent, b.allocated) >= 75).length === 0 && (
                                <p className="text-center text-gray-500 py-4">
                                    ✅ Aucune alerte budgétaire - Tous les budgets sont sous contrôle
                                </p>
                            )}
                    </div>
                </CardContent>
            </Card>

            {/* Modal Ajout Budget */}
            <Dialog open={isAddingBudget} onOpenChange={setIsAddingBudget}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ajouter un Budget</DialogTitle>
                        <DialogDescription>
                            Définissez un budget pour une nouvelle catégorie de dépenses.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium">Catégorie</label>
                            <Input
                                placeholder="Ex: Matériel informatique"
                                value={newBudget.category}
                                onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Budget Alloué (FCFA)</label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={newBudget.allocated || ''}
                                onChange={(e) => setNewBudget({ ...newBudget, allocated: Number(e.target.value) })}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddingBudget(false)}>
                            Annuler
                        </Button>
                        <Button onClick={handleAddBudget}>
                            Ajouter Budget
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal Ajout Dépense */}
            <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Enregistrer une Dépense</DialogTitle>
                        <DialogDescription>
                            Ajoutez une nouvelle dépense à imputer sur un budget.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium">Catégorie Budgétaire</label>
                            <select
                                value={newExpense.budgetCategory}
                                onChange={(e) => setNewExpense({ ...newExpense, budgetCategory: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                            >
                                <option value="">Sélectionner...</option>
                                {budgets.filter(b => b.type === 'expense').map(b => (
                                    <option key={b.id} value={b.category}>{b.category}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <Input
                                placeholder="Ex: Achat de 10 ordinateurs"
                                value={newExpense.description}
                                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Montant (FCFA)</label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={newExpense.amount || ''}
                                onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Date</label>
                            <Input
                                type="date"
                                value={newExpense.date}
                                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddingExpense(false)}>
                            Annuler
                        </Button>
                        <Button onClick={handleAddExpense}>
                            Enregistrer Dépense
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
