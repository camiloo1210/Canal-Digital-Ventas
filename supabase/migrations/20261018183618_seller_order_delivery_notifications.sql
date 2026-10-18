-- Route the completed fulfillment event through the existing notification outbox.
-- No business transitions or financial RPCs are introduced by this migration.
BEGIN;
INSERT INTO core.outbox_relay_routes(worker_role,aggregate_type,event_type)
VALUES ('outbox_worker_role','Order','OrderDeliveredEvent')
ON CONFLICT DO NOTHING;
COMMIT;
