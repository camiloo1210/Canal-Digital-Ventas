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

export interface KiviOrderLookupLine {
  name: string;
  quantity: number;
  /** Decimal string in the store currency, for example "12.50". */
  unitPrice: string;
  /** Cover photo (public https URL) or null. */
  imageUrl: string | null;
}

/**
 * What an order reveals to the chat assistant: its progress and contents, never who bought it or
 * where it ships. Keep it that way: an order reference alone can open this view.
 */
export interface KiviOrderLookupItem {
  orderNumber: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  currency: string;
  /** Decimal string, for example "36.00". */
  total: string;
  items: KiviOrderLookupLine[];
}

export interface KiviOrderLookupReadPort {
  /** Returns an empty list when the store has no active Kivi connection. */
  findLatestOrders(query: KiviOrderLookupQuery): Promise<KiviOrderLookupItem[]>;
}
