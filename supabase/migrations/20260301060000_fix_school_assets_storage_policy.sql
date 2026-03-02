-- Fix storage policies for school-assets bucket
-- Drop the previous policies that were causing timeout/evaluation issues
DROP POLICY IF EXISTS "Admins can upload school assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update school assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete school assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can view school assets" ON storage.objects;

-- Create simpler policies for school-assets
DROP POLICY IF EXISTS "Allow uploads to school-assets" ON storage.objects;
CREATE POLICY "Allow uploads to school-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "Allow updates to school-assets" ON storage.objects;
CREATE POLICY "Allow updates to school-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "Allow delete from school-assets" ON storage.objects;
CREATE POLICY "Allow delete from school-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "Allow read from school-assets" ON storage.objects;
CREATE POLICY "Allow read from school-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'school-assets');
