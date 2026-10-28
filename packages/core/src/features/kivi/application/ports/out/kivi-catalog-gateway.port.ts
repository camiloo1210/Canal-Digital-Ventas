/** In-memory delivery target. The token is resolved per call and must never be logged or persisted. */
export interface KiviTarget {
  baseUrl: string;
  connectionId: string;
  token: string;
}

export interface KiviProductPayload {
  version: number;
  name: string;
  /** Decimal string, e.g. "3.50". */
  price: string;
  currency: string;
  description: string | null;
  is_available: boolean;
  is_orderable: boolean;
}

export interface KiviProductIdentity {
  externalId: string;
  kiviProductId: string | null;
  version: number;
  deleted: boolean;
}

export interface KiviCatalogGatewayPort {
  /** Resolves only when Kivi accepted the write (2xx). */
  putProduct(target: KiviTarget, externalId: string, payload: KiviProductPayload): Promise<void>;
  deleteProduct(target: KiviTarget, externalId: string, version: number): Promise<void>;
  /** Null when Kivi has no mapping for the external id. */
  getIdentity(target: KiviTarget, externalId: string): Promise<KiviProductIdentity | null>;
  /** Kivi-side ids of the tenant catalog (GET /catalog/products). */
  listKiviProductIds(target: KiviTarget): Promise<string[]>;
}
