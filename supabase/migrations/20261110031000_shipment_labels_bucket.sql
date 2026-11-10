-- Private bucket for carrier shipment labels. Objects are written server-side only by the
-- shipment-creation worker (storage service client) at `${tenantId}/${uuid}.pdf`; browsers
-- never upload, update or delete here. Members who may see orders of the tenant can read
-- (signed URLs are issued server-side for them).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shipment-labels', 'shipment-labels', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Shipment labels order reader" ON storage.objects;
CREATE POLICY "Shipment labels order reader" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'shipment-labels' AND EXISTS (
  SELECT 1 FROM core.tenant_memberships m
  WHERE m.user_id = auth.uid() AND m.status = 'active'
    AND m.tenant_id::text = (storage.foldername(name))[1]
    AND core.current_member_has_permission(m.tenant_id, ARRAY['VIEW_ORDERS', 'MANAGE_ORDERS']::text[])
));
