/** Must match the core.outbox_relay_routes rows seeded for kivi_sync_worker_role. */
export const KIVI_PRODUCT_EVENT_TYPES: string[] = [
  'ProductCreatedEvent',
  'ProductDetailsChangedEvent',
  'ProductPricingChangedEvent',
  'ProductStockAdjustedEvent',
  'ProductArchivedEvent',
];
