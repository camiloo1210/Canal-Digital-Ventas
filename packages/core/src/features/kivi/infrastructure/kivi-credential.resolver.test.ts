import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { KiviCredentialResolver } from '@/kivi/infrastructure/kivi-credential.resolver';
import { EnvKiviSecretResolver } from '@/kivi/infrastructure/env-kivi-secret.resolver';
import { AesGcmKiviTokenCipher } from '@/kivi/infrastructure/aes-gcm-kivi-token.cipher';
import { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviBaseUrl } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { KiviSecretRef } from '@/kivi/domain/value-objects/kivi-secret-ref.vo';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const CONNECTION = '22222222-2222-4222-8222-222222222222';
const PAIRED_TOKEN = 'kc_' + 'P'.repeat(43);
const LEGACY_TOKEN = 'kc_' + 'L'.repeat(43);
const cipher = new AesGcmKiviTokenCipher(randomBytes(32).toString('base64'));
const legacy = new EnvKiviSecretResolver({ KIVI_CONNECTION_TOKEN_STORE: LEGACY_TOKEN });
const resolver = new KiviCredentialResolver(cipher, legacy);
const baseUrl = KiviBaseUrl.from('https://api.kivi.example');

describe('KiviCredentialResolver', (): void => {
  it('decrypts the paired token', (): void => {
    const connection = KiviConnection.pair({
      tenantId: TENANT,
      baseUrl,
      connectionId: CONNECTION,
      encryptedToken: cipher.encrypt(PAIRED_TOKEN, TENANT),
    });
    expect(resolver.resolve(connection)).toBe(PAIRED_TOKEN);
  });

  it('falls back to the legacy env reference when there is no ciphertext', (): void => {
    const connection = KiviConnection.link({
      tenantId: TENANT,
      baseUrl,
      connectionId: CONNECTION,
      secretRef: KiviSecretRef.from('KIVI_CONNECTION_TOKEN_STORE'),
    });
    expect(resolver.resolve(connection)).toBe(LEGACY_TOKEN);
  });

  it('rejects a row with two credential sources', (): void => {
    expect((): KiviConnection =>
      KiviConnection.reconstitute({
        tenantId: TENANT,
        baseUrl,
        connectionId: CONNECTION,
        secretRef: KiviSecretRef.from('KIVI_CONNECTION_TOKEN_STORE'),
        encryptedToken: cipher.encrypt(PAIRED_TOKEN, TENANT),
        status: 'active',
        lastReconciledAt: null,
      }),
    ).toThrow(InvalidKiviConnectionException);
  });

  it('returns null, not another credential, for ciphertext moved across tenants or corrupted', (): void => {
    const moved = KiviConnection.pair({
      tenantId: OTHER,
      baseUrl,
      connectionId: CONNECTION,
      encryptedToken: cipher.encrypt(PAIRED_TOKEN, TENANT),
    });
    expect(resolver.resolve(moved)).toBeNull();
    const corrupt = KiviConnection.pair({
      tenantId: TENANT,
      baseUrl,
      connectionId: CONNECTION,
      encryptedToken: { ciphertext: 'v1.bad.bad', keyVersion: 1 },
    });
    expect(resolver.resolve(corrupt)).toBeNull();
  });

  it('returns null for an unlinked connection with no credential source', (): void => {
    const connection = KiviConnection.pair({
      tenantId: TENANT,
      baseUrl,
      connectionId: CONNECTION,
      encryptedToken: cipher.encrypt(PAIRED_TOKEN, TENANT),
    });
    connection.unlink();
    expect(resolver.resolve(connection)).toBeNull();
  });
});
