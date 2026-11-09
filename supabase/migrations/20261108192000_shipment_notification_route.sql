-- Must be applied before the worker is deployed with OrderShipmentUpdatedEvent enabled.
INSERT INTO core.outbox_relay_routes(worker_role, aggregate_type, event_type)
VALUES ('outbox_worker_role', 'Order', 'OrderShipmentUpdatedEvent')
ON CONFLICT (worker_role, aggregate_type, event_type) DO NOTHING;
