-- Apply before enabling REFUND_NOTIFICATIONS_ENABLED on the outbox worker.
INSERT INTO core.outbox_relay_routes(worker_role, aggregate_type, event_type)
VALUES ('outbox_worker_role', 'Order', 'OrderRefundedEvent')
ON CONFLICT (worker_role, aggregate_type, event_type) DO NOTHING;
