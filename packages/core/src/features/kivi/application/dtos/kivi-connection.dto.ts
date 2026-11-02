export interface LinkStoreToKiviDto {
  userId: string;
  tenantId: string;
  baseUrl: string;
  connectionId: string;
  /** Name of the server env var holding the `kc_` token. Never the token itself. */
  secretRef: string;
}

export interface PairStoreWithKiviDto {
  userId: string;
  tenantId: string;
  /** One-time `kvp_...` pairing code generated in Kivi. Never persisted. */
  code: string;
  /**
   * Bare public https origin of this deployment (e.g. https://shop.example), or null when unknown.
   * Used only to hand Kivi the order-lookup URL and key; ignored when not a public https origin.
   */
  publicOrigin: string | null;
}

export interface RequestKiviSyncDto {
  userId: string;
  tenantId: string;
}

export interface UnlinkStoreFromKiviDto {
  userId: string;
  tenantId: string;
}
