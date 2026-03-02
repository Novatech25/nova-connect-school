-- =====================================================
-- Supprimer un enregistrement parent incomplet
-- À utiliser si un parent existe dans parents mais pas dans auth.users
-- =====================================================

-- Remplacez par l'email du parent incomplet
DELETE FROM parents
WHERE email = 'altman25@gmail.com'  -- ← MODIFIER
  AND NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.email = parents.email
  );

-- Vérifier que c'est supprimé
SELECT email, id::text
FROM parents
WHERE email = 'altman25@gmail.com';  -- ← MODIFIER
