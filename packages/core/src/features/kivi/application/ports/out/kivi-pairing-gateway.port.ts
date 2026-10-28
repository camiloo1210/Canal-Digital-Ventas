import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';

export interface KiviPairingExchangeRequest {
  /** One-time `kvp_...` pairing code generated in Kivi. */
  code: string;
  /** The Canal store (tenant) id, so Kivi can correlate the connection. */
  externalTenantId: string;
  /** Human-readable store name. */
  name: string;
}

export interface KiviPairingExchangeResult {
  connectionId: string;
  /** `kc_...` token. Issued once by Kivi; the caller must encrypt it and never log it. */
  token: string;
  scopes: string[];
  expiresAt: string | null;
}

export interface KiviPairingGatewayPort {
  /** Throws KiviPairingException (invalid_or_expired_code | rate_limited | unavailable). */
  exchange(request: KiviPairingExchangeRequest): Promise<KiviPairingExchangeResult>;
  /** Idempotent self-revocation of a connection token. Throws KiviPairingException on failure. */
  revokeSelf(target: KiviTarget): Promise<void>;
}
