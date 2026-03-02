-- ============================================================
-- FONCTIONS SQL POUR LE DASHBOARD COMPTABLE
-- Statistiques financières en temps réel
-- ============================================================

-- Fonction pour obtenir les encaissements du mois
CREATE OR REPLACE FUNCTION get_monthly_collections_rpc(p_school_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC := 0;
    v_start_of_month DATE;
BEGIN
    v_start_of_month := DATE_TRUNC('month', CURRENT_DATE);
    
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total
    FROM payments
    WHERE school_id = p_school_id
      AND status = 'completed'
      AND payment_date >= v_start_of_month;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les arriérés totaux
CREATE OR REPLACE FUNCTION get_total_arrears_rpc(p_school_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0)
    INTO v_total
    FROM fee_schedules
    WHERE school_id = p_school_id
      AND status IN ('pending', 'partial')
      AND due_date < CURRENT_DATE;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les salaires à payer
CREATE OR REPLACE FUNCTION get_pending_salaries_rpc(p_school_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC := 0;
    v_start_of_month DATE;
BEGIN
    v_start_of_month := DATE_TRUNC('month', CURRENT_DATE);
    
    SELECT COALESCE(SUM(net_salary - COALESCE(
        (SELECT SUM(amount) FROM payroll_payments WHERE payroll_entry_id = pe.id),
        0
    )), 0)
    INTO v_total
    FROM payroll_entries pe
    WHERE pe.school_id = p_school_id
      AND pe.created_at >= v_start_of_month
      AND pe.status IN ('draft', 'pending', 'validated');
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir le nombre de transactions du mois
CREATE OR REPLACE FUNCTION get_monthly_transactions_count_rpc(p_school_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_payment_count INTEGER := 0;
    v_payroll_count INTEGER := 0;
    v_start_of_month DATE;
BEGIN
    v_start_of_month := DATE_TRUNC('month', CURRENT_DATE);
    
    -- Compter les paiements étudiants
    SELECT COUNT(*) INTO v_payment_count
    FROM payments
    WHERE school_id = p_school_id
      AND status = 'completed'
      AND payment_date >= v_start_of_month;
    
    -- Compter les paiements de salaires
    SELECT COUNT(*) INTO v_payroll_count
    FROM payroll_payments
    WHERE school_id = p_school_id
      AND payment_date >= v_start_of_month;
    
    RETURN v_payment_count + v_payroll_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction principale qui retourne toutes les stats
CREATE OR REPLACE FUNCTION get_accountant_dashboard_stats_rpc(p_school_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_monthly_collections NUMERIC;
    v_total_arrears NUMERIC;
    v_pending_salaries NUMERIC;
    v_monthly_transactions INTEGER;
BEGIN
    v_monthly_collections := get_monthly_collections_rpc(p_school_id);
    v_total_arrears := get_total_arrears_rpc(p_school_id);
    v_pending_salaries := get_pending_salaries_rpc(p_school_id);
    v_monthly_transactions := get_monthly_transactions_count_rpc(p_school_id);
    
    RETURN jsonb_build_object(
        'monthlyCollections', v_monthly_collections,
        'totalArrears', v_total_arrears,
        'pendingSalaries', v_pending_salaries,
        'monthlyTransactions', v_monthly_transactions
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION get_monthly_collections_rpc(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_total_arrears_rpc(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_pending_salaries_rpc(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_monthly_transactions_count_rpc(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_accountant_dashboard_stats_rpc(UUID) TO anon, authenticated, service_role;

-- Commentaires
COMMENT ON FUNCTION get_accountant_dashboard_stats_rpc(UUID) IS 'Retourne toutes les statistiques du dashboard comptable';
