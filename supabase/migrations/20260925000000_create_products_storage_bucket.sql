-- Migration: Create and Configure products Storage Bucket
-- Ensure idempotency and configuration convergence (ON CONFLICT DO UPDATE)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'products', 
  'products', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) 
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: Public Read Access for B2C Storefront Catalogs
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'products');

-- RLS: Tenant-Isolated Uploads (B2B Admin)
-- Prevents authenticated users without active memberships from uploading.
-- Ensures uploads only go to the folder strictly matching the active tenant ID.
CREATE POLICY "Tenant-Isolated Uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'products' 
  AND EXISTS (
    SELECT 1 
    FROM core.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
      AND tm.status = 'active'
  )
);
