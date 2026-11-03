export interface KiviOrderLookupQuery {
  /** Canal store id, as sent to Kivi at pairing (external_tenant_id). */
  tenantId: string;
  /** Digits only, no leading plus. Null when the asker is not verified. */
  phone: string | null;
  /**
   * Without a phone the order is found by its reference alone, which is only allowed for
   * unguessable references (see `isUnguessableOrderNumber`); anything else returns no orders.
   */
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
