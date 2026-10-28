import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AesGcmKiviTokenCipher,
  loadKiviTokenCipher,
} from '@/kivi/infrastructure/aes-gcm-kivi-token.cipher';
import { KiviConfigurationException } from '@/kivi/infrastructure/kivi-configuration.exception';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '99999999-9999-4999-8999-999999999999';
const TOKEN = 'kc_' + 'Z'.repeat(43);
const keyB64 = (): string => randomBytes(32).toString('base64');

describe('AesGcmKiviTokenCipher', (): void => {
  it('translates malformed and unauthenticated envelopes into custom infrastructure failures', (): void => {
    const cipher = new AesGcmKiviTokenCipher(keyB64());
    const encrypted = cipher.encrypt(TOKEN, TENANT_A);
    for (const envelope of [
      { ciphertext: 'invalid', keyVersion: 1 },
      { ciphertext: 'v1.AAAA.AAAA', keyVersion: 1 },
      encrypted,
    ]) {
      expect((): string => cipher.decrypt(envelope, TENANT_B)).toThrow(InfrastructureException);
    }
  });
  it('round-trips and never leaves the plaintext in the envelope', (): void => {
    const cipher = new AesGcmKiviTokenCipher(keyB64());
    const encrypted = cipher.encrypt(TOKEN, TENANT_A);
    expect(encrypted.ciphertext).not.toContain(TOKEN);
    expect(encrypted.ciphertext.startsWith('v1.')).toBe(true);
    expect(encrypted.keyVersion).toBe(1);
    expect(cipher.decrypt(encrypted, TENANT_A)).toBe(TOKEN);
  });

  it('uses a fresh random IV every time', (): void => {
    const cipher = new AesGcmKiviTokenCipher(keyB64());
    const a = cipher.encrypt(TOKEN, TENANT_A).ciphertext;
    const b = cipher.encrypt(TOKEN, TENANT_A).ciphertext;
    expect(a).not.toBe(b);
    expect(a.split('.')[1]).not.toBe(b.split('.')[1]);
    expect(Buffer.from(a.split('.')[1], 'base64url')).toHaveLength(12);
  });

  it('binds the ciphertext to its tenant', (): void => {
    const cipher = new AesGcmKiviTokenCipher(keyB64());
    const encrypted = cipher.encrypt(TOKEN, TENANT_A);
    expect((): string => cipher.decrypt(encrypted, TENANT_B)).toThrow();
  });

  it('rejects tampering, a wrong key and malformed envelopes', (): void => {
    const cipher = new AesGcmKiviTokenCipher(keyB64());
    const encrypted = cipher.encrypt(TOKEN, TENANT_A);
    const parts = encrypted.ciphertext.split('.');
    const body = Buffer.from(parts[2], 'base64url');
    body[0] ^= 1;
    const tampered = { ...encrypted, ciphertext: `v1.${parts[1]}.${body.toString('base64url')}` };
    expect((): string => cipher.decrypt(tampered, TENANT_A)).toThrow();
    expect((): string =>
      new AesGcmKiviTokenCipher(keyB64()).decrypt(encrypted, TENANT_A),
    ).toThrow();
    for (const bad of ['', 'v1.', 'v2.a.b', 'garbage', 'v1.AAAA.AAAA']) {
      expect((): string => cipher.decrypt({ ciphertext: bad, keyVersion: 1 }, TENANT_A)).toThrow();
    }
    expect((): string => cipher.decrypt({ ...encrypted, keyVersion: 2 }, TENANT_A)).toThrow();
  });

  it('error messages never include the token or the ciphertext', (): void => {
    const cipher = new AesGcmKiviTokenCipher(keyB64());
    const encrypted = cipher.encrypt(TOKEN, TENANT_A);
    try {
      cipher.decrypt(encrypted, TENANT_B);
      expect.unreachable();
    } catch (error: unknown) {
      const text = String((error as Error).message) + String((error as Error).stack);
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain(encrypted.ciphertext);
    }
  });

  it('requires a 32-byte base64 key', (): void => {
    expect(
      (): AesGcmKiviTokenCipher => new AesGcmKiviTokenCipher(randomBytes(16).toString('base64')),
    ).toThrow(KiviConfigurationException);
    expect((): AesGcmKiviTokenCipher => new AesGcmKiviTokenCipher('not base64 !!')).toThrow(
      KiviConfigurationException,
    );
    expect((): AesGcmKiviTokenCipher => new AesGcmKiviTokenCipher('')).toThrow(
      KiviConfigurationException,
    );
  });
});

describe('loadKiviTokenCipher', (): void => {
  it('fails closed with a clear error when the key is missing or invalid', (): void => {
    expect((): AesGcmKiviTokenCipher => loadKiviTokenCipher({})).toThrow(
      /KIVI_TOKEN_ENCRYPTION_KEY/,
    );
    expect((): AesGcmKiviTokenCipher =>
      loadKiviTokenCipher({ KIVI_TOKEN_ENCRYPTION_KEY: 'short' }),
    ).toThrow(KiviConfigurationException);
    const key = keyB64();
    try {
      loadKiviTokenCipher({ KIVI_TOKEN_ENCRYPTION_KEY: key.slice(0, 10) });
    } catch (error: unknown) {
      expect((error as Error).message).not.toContain(key.slice(0, 10));
    }
    expect(loadKiviTokenCipher({ KIVI_TOKEN_ENCRYPTION_KEY: key })).toBeInstanceOf(
      AesGcmKiviTokenCipher,
    );
  });
});
