import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type {
  KiviEncryptedToken,
  KiviTokenCipherPort,
} from '@/kivi/application/ports/out/kivi-token-cipher.port';
import { KiviConfigurationException } from '@/kivi/infrastructure/kivi-configuration.exception';
import { KiviTokenCipherException } from '@/kivi/application/exceptions/kivi-token-cipher.exception';

const ENVELOPE_VERSION = 'v1';
const KEY_VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * AES-256-GCM with a random 96-bit IV per message. Envelope: `v1.<iv>.<ciphertext||tag>`
 * (base64url). The tenant id is the AAD, so an envelope moved to another tenant's row fails
 * authentication. Failures carry no plaintext, key or envelope content.
 */
export class AesGcmKiviTokenCipher implements KiviTokenCipherPort {
  private readonly key: Buffer;

  public constructor(keyBase64: string) {
    const trimmed = keyBase64.trim();
    const key = BASE64.test(trimmed) ? Buffer.from(trimmed, 'base64') : Buffer.alloc(0);
    if (key.length !== KEY_BYTES) {
      throw new KiviConfigurationException(
        'KIVI_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
      );
    }
    this.key = key;
  }

  public encrypt(token: string, tenantId: string): KiviEncryptedToken {
    try {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', this.key, iv);
      cipher.setAAD(Buffer.from(tenantId, 'utf8'));
      const body = Buffer.concat([
        cipher.update(token, 'utf8'),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
      return {
        ciphertext: `${ENVELOPE_VERSION}.${iv.toString('base64url')}.${body.toString('base64url')}`,
        keyVersion: KEY_VERSION,
      };
    } catch {
      throw new KiviTokenCipherException();
    }
  }

  public decrypt(encrypted: KiviEncryptedToken, tenantId: string): string {
    const parts = encrypted.ciphertext.split('.');
    if (
      encrypted.keyVersion !== KEY_VERSION ||
      parts.length !== 3 ||
      parts[0] !== ENVELOPE_VERSION
    ) {
      throw new KiviTokenCipherException();
    }
    const iv = Buffer.from(parts[1], 'base64url');
    const body = Buffer.from(parts[2], 'base64url');
    if (iv.length !== IV_BYTES || body.length <= TAG_BYTES) {
      throw new KiviTokenCipherException();
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAAD(Buffer.from(tenantId, 'utf8'));
      decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
      return Buffer.concat([
        decipher.update(body.subarray(0, body.length - TAG_BYTES)),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new KiviTokenCipherException();
    }
  }
}

/** Fails closed: no key, no cipher. */
export function loadKiviTokenCipher(
  env: Record<string, string | undefined>,
): AesGcmKiviTokenCipher {
  const raw = env.KIVI_TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.trim() === '') {
    throw new KiviConfigurationException('KIVI_TOKEN_ENCRYPTION_KEY is not configured');
  }
  return new AesGcmKiviTokenCipher(raw);
}
