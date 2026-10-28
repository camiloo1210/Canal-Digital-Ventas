import type { KiviEncryptedToken } from '@/kivi/domain/value-objects/kivi-encrypted-token';

export type { KiviEncryptedToken };

/**
 * Encrypts the Kivi connection token at rest. The tenant id is authenticated data: an envelope
 * copied to another tenant's row fails to decrypt.
 */
export interface KiviTokenCipherPort {
  encrypt(token: string, tenantId: string): KiviEncryptedToken;
  /** Throws when the envelope is malformed, tampered with, or bound to a different tenant. */
  decrypt(encrypted: KiviEncryptedToken, tenantId: string): string;
}
