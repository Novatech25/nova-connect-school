-- Migration to add logo_url to schools table
ALTER TABLE public.schools
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Bucket creation if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for school-assets bucket
-- Admins can upload to school-assets
CREATE POLICY "Admins can upload school assets" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'school-assets' AND
  (auth.jwt() ->> 'role' = 'admin')
);

-- Admins can update their school assets
CREATE POLICY "Admins can update school assets" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'school-assets' AND
  (auth.jwt() ->> 'role' = 'admin')
);

-- Admins can delete their school assets
CREATE POLICY "Admins can delete school assets" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'school-assets' AND
  (auth.jwt() ->> 'role' = 'admin')
);

-- Everyone can view school assets
CREATE POLICY "Public can view school assets" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'school-assets');
