-- Store identity assets are public; writes require an active store manager.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('store-branding', 'store-branding', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=EXCLUDED.public,
  file_size_limit=EXCLUDED.file_size_limit, allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE POLICY "Store branding public read" ON storage.objects FOR SELECT
USING (bucket_id='store-branding');

CREATE POLICY "Store branding manager upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='store-branding' AND EXISTS (
  SELECT 1 FROM core.tenant_memberships m WHERE m.user_id=auth.uid()
    AND m.tenant_id::text=(storage.foldername(name))[1]
    AND m.status='active' AND m.role IN ('OWNER','ADMIN')
));

CREATE POLICY "Store branding manager cleanup" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='store-branding' AND EXISTS (
  SELECT 1 FROM core.tenant_memberships m WHERE m.user_id=auth.uid()
    AND m.tenant_id::text=(storage.foldername(name))[1]
    AND m.status='active' AND m.role IN ('OWNER','ADMIN')
));
