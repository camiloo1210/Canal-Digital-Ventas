export interface KiviOrderLookupQuery {
  /** Canal store id, as sent to Kivi at pairing (external_tenant_id). */
  tenantId: string;
  /** Digits only, no leading plus. */
  phone: string;
  orderNumber: string | null;
}

export interface KiviOrderLookupItem {
  orderNumber: string;
  status: string;
  updatedAt: string;
}

export interface KiviOrderLookupReadPort {
  /** Returns an empty list when the store has no active Kivi connection. */
  findLatestOrders(query: KiviOrderLookupQuery): Promise<KiviOrderLookupItem[]>;
}
