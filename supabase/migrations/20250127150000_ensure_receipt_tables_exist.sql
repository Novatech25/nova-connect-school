-- Migration: S'assurer que tous les éléments pour les reçus existent
-- Exécutez cette migration sur votre projet Supabase distant

-- 1. Vérifier/Créer la table payment_receipts
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL UNIQUE,
  pdf_url TEXT NOT NULL,
  pdf_size_bytes INTEGER,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  printer_profile_id UUID REFERENCES printer_profiles(id) ON DELETE SET NULL,
  verification_token_id UUID REFERENCES receipt_verification_tokens(id) ON DELETE SET NULL,
  auto_sent BOOLEAN DEFAULT FALSE,
  send_channels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter commentaires
COMMENT ON TABLE public.payment_receipts IS 'Stocke les reçus de paiement générés';
COMMENT ON COLUMN public.payment_receipts.receipt_number IS 'Numéro de reçu unique (ex: REC-2025-0001)';
COMMENT ON COLUMN public.payment_receipts.pdf_url IS 'Chemin du fichier PDF dans le storage';

-- 2. Vérifier/Créer la table receipt_verification_tokens
CREATE TABLE IF NOT EXISTS public.receipt_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL,
  receipt_type TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON public.receipt_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON public.receipt_verification_tokens(expires_at);

COMMENT ON TABLE public.receipt_verification_tokens IS 'Tokens de vérification pour les reçus (QR codes)';

-- 3. Créer la fonction pour générer les numéros de reçu
CREATE OR REPLACE FUNCTION generate_receipt_number(
  p_school_id UUID,
  p_receipt_type TEXT
) RETURNS TEXT AS $$
DECLARE
  v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_sequence_num INTEGER;
  v_receipt_number TEXT;
BEGIN
  -- Obtenir le dernier numéro de séquence pour cette école et cette année
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM '-([0-9]+)$') AS INTEGER)), 0)
  INTO v_sequence_num
  FROM public.payment_receipts
  WHERE school_id = p_school_id
    AND receipt_number LIKE 'REC-' || v_year || '%';

  -- Incrémenter
  v_sequence_num := v_sequence_num + 1;

  -- Générer le numéro de reçu
  v_receipt_number := 'REC-' || v_year || '-' || LPAD(v_sequence_num::TEXT, 4, '0');

  RETURN v_receipt_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. S'assurer que le bucket payment-receipts existe
-- Note: Les buckets doivent être créés manuellement dans le Dashboard Supabase
-- Allez sur: https://supabase.com/dashboard/project/mdfzmdddmwpbqmkxomdb/storage
-- Et créez un bucket nommé "payment-receipts" avec les policies appropriées

-- 5. Créer les RLS policies pour payment_receipts
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- Policy pour les admins de l'école
CREATE POLICY "school_admins_can_view_own_receipts"
  ON public.payment_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.school_id = public.payment_receipts.school_id
        AND user_roles.role_id IN (SELECT id FROM roles WHERE name IN ('school_admin', 'accountant'))
    )
  );

CREATE POLICY "school_admins_can_insert_own_receipts"
  ON public.payment_receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.school_id = public.payment_receipts.school_id
        AND user_roles.role_id IN (SELECT id FROM roles WHERE name IN ('school_admin', 'accountant'))
    )
  );

-- 6. Activer triggers pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_receipts_updated_at
  BEFORE UPDATE ON public.payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Créer les indexes pour les performances
CREATE INDEX IF NOT EXISTS idx_payment_receipts_school_id ON public.payment_receipts(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_id ON public.payment_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_receipt_number ON public.payment_receipts(receipt_number);
