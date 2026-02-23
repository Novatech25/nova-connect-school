-- Créer le bucket 'documents' pour les fichiers étudiants
-- À exécuter dans le SQL Editor de Supabase

-- 1. Créer le bucket (idéalement via l'interface UI de Supabase Storage)
-- Aller dans Storage > New bucket > Nom: documents > Public: false

-- 2. Activer RLS sur le bucket (déjà activé par défaut)

-- 3. Créer les policies pour le bucket 'documents'

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Policy: Allow authenticated users to read their school files
CREATE POLICY "Allow authenticated select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documents');

-- Policy: Allow authenticated users to update their files
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'documents');

-- Policy: Allow authenticated users to delete their files
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents');

-- Alternative: Policy plus restrictive par école (si le chemin contient l'ID de l'école)
-- CREATE POLICY "Allow school-based access" ON storage.objects
-- FOR ALL TO authenticated
-- USING (bucket_id = 'documents' AND auth.uid() IN (
--   SELECT user_id FROM users WHERE school_id = (split_part(name, '/', 1))::uuid
-- ));
