import { describe, expect, it } from 'vitest';
import { KiviSecretRef } from '@/kivi/domain/value-objects/kivi-secret-ref.vo';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';

describe('KiviSecretRef', (): void => {
  it('accepts a KIVI_CONNECTION_TOKEN_* environment reference', (): void => {
    expect(KiviSecretRef.from('KIVI_CONNECTION_TOKEN_STORE_1').getValue()).toBe(
      'KIVI_CONNECTION_TOKEN_STORE_1',
    );
  });

  it.each([
    'kc_' + 'a'.repeat(43),
    'DATABASE_URL',
    'KIVI_CONNECTION_TOKEN_',
    'KIVI_CONNECTION_TOKEN_lower',
    'KIVI_CONNECTION_TOKEN_A B',
    '',
  ])(
    'rejects %s (a raw credential or an unrelated variable must never be stored)',
    (raw: string): void => {
      expect((): KiviSecretRef => KiviSecretRef.from(raw)).toThrow(InvalidKiviConnectionException);
    },
  );

  it('never reveals the reference in its string form', (): void => {
    expect(String(KiviSecretRef.from('KIVI_CONNECTION_TOKEN_A'))).not.toContain('KIVI');
  });
});
