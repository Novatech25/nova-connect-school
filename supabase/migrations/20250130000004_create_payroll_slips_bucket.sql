-- Migration: Create Payroll Slips Storage Bucket
-- Created: 2025-01-30
-- Description: Creates storage bucket for payroll slips with appropriate RLS policies

-- Créer le bucket pour les fiches de paie
-- RLS pour le bucket
CREATE POLICY "Accountants can upload payroll slips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payroll-slips'
  AND (is_school_admin() OR is_accountant())
);

CREATE POLICY "Accountants can read all payroll slips"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payroll-slips'
  AND (is_school_admin() OR is_accountant() OR is_super_admin())
);

CREATE POLICY "Teachers can read own payroll slips"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payroll-slips'
  AND is_teacher()
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Accountants can delete payroll slips"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payroll-slips'
  AND (is_school_admin() OR is_accountant())
);
