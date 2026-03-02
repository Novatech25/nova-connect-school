-- Migration pour créer les tables de gestion budgétaire
-- Créée le: 2026-02-10

-- =============================================
-- Table: budgets
-- Description: Stocke les budgets alloués par catégorie pour chaque école et année scolaire
-- =============================================
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    allocated_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    budget_type TEXT NOT NULL DEFAULT 'expense' CHECK (budget_type IN ('revenue', 'expense')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Contraintes
    CONSTRAINT positive_allocated_amount CHECK (allocated_amount >= 0),
    CONSTRAINT unique_budget_per_category UNIQUE (school_id, academic_year_id, category, budget_type)
);

-- Index pour performance
CREATE INDEX idx_budgets_school_year ON budgets(school_id, academic_year_id);
CREATE INDEX idx_budgets_category ON budgets(category);
CREATE INDEX idx_budgets_type ON budgets(budget_type);

-- Trigger pour updated_at
CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Table: expenses
-- Description: Stocke les dépenses réelles effectuées
-- =============================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
    budget_category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method TEXT,
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Contraintes
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Index pour performance
CREATE INDEX idx_expenses_school_year ON expenses(school_id, academic_year_id);
CREATE INDEX idx_expenses_budget ON expenses(budget_id);
CREATE INDEX idx_expenses_category ON expenses(budget_category);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- Trigger pour updated_at
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Activer RLS
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Politique pour budgets : Les utilisateurs peuvent voir les budgets de leur école
CREATE POLICY "Users can view budgets of their school"
    ON budgets FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Politique pour budgets : Les admins et comptables peuvent créer des budgets
CREATE POLICY "Admins and accountants can insert budgets"
    ON budgets FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'accountant')
        )
    );

-- Politique pour budgets : Les admins et comptables peuvent modifier des budgets
CREATE POLICY "Admins and accountants can update budgets"
    ON budgets FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'accountant')
        )
    );

-- Politique pour budgets : Les admins peuvent supprimer des budgets
CREATE POLICY "Admins can delete budgets"
    ON budgets FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Politique pour expenses : Les utilisateurs peuvent voir les dépenses de leur école
CREATE POLICY "Users can view expenses of their school"
    ON expenses FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Politique pour expenses : Les admins et comptables peuvent créer des dépenses
CREATE POLICY "Admins and accountants can insert expenses"
    ON expenses FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'accountant')
        )
    );

-- Politique pour expenses : Les admins et comptables peuvent modifier des dépenses
CREATE POLICY "Admins and accountants can update expenses"
    ON expenses FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'accountant')
        )
    );

-- Politique pour expenses : Les admins peuvent supprimer des dépenses
CREATE POLICY "Admins can delete expenses"
    ON expenses FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- =============================================
-- Commentaires
-- =============================================
COMMENT ON TABLE budgets IS 'Stocke les budgets alloués par catégorie pour chaque école et année scolaire';
COMMENT ON TABLE expenses IS 'Stocke les dépenses réelles effectuées par catégorie budgétaire';

COMMENT ON COLUMN budgets.category IS 'Catégorie du budget (ex: Salaires, Fournitures, Infrastructure)';
COMMENT ON COLUMN budgets.allocated_amount IS 'Montant alloué pour cette catégorie';
COMMENT ON COLUMN budgets.budget_type IS 'Type: revenue (revenus) ou expense (dépenses)';

COMMENT ON COLUMN expenses.budget_category IS 'Catégorie budgétaire à laquelle imputer la dépense';
COMMENT ON COLUMN expenses.expense_date IS 'Date de la dépense';
COMMENT ON COLUMN expenses.amount IS 'Montant de la dépense';
