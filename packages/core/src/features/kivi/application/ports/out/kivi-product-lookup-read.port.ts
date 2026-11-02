export type KiviProductAvailability = 'available' | 'low_stock' | 'out_of_stock';

/** Public-facing projection: never the exact stock, cost or internal ids. */
export interface KiviProductLookupItem {
  name: string;
  sku: string;
  category: string;
  /** Decimal string, e.g. "3.50". */
  price: string;
  currency: string;
  wholesale_price: string | null;
  wholesale_min_quantity: number | null;
  availability: KiviProductAvailability;
}

export interface KiviProductLookupQuery {
  /** Canal store id (verified signature tenant). */
  tenantId: string;
  query: string;
}

export interface KiviProductLookupReadPort {
  /** At most 5 active products of the tenant. */
  findProducts(query: KiviProductLookupQuery): Promise<KiviProductLookupItem[]>;
}
