import { describe, expect, it } from 'vitest';
import { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviBaseUrl } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { KiviSecretRef } from '@/kivi/domain/value-objects/kivi-secret-ref.vo';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';

const link = (): KiviConnection =>
  KiviConnection.link({
    tenantId: '11111111-1111-4111-8111-111111111111',
    baseUrl: KiviBaseUrl.from('https://api.kivi.example'),
    connectionId: '22222222-2222-4222-8222-222222222222',
    secretRef: KiviSecretRef.from('KIVI_CONNECTION_TOKEN_STORE'),
  });

describe('KiviConnection', (): void => {
  it('starts pending the initial load and never reconciled', (): void => {
    const connection = link();
    expect(connection.getStatus()).toBe('pending');
    expect(connection.getLastReconciledAt()).toBeNull();
    expect(connection.isSyncing()).toBe(true);
  });

  it('rejects a connection id that is not a uuid', (): void => {
    expect((): KiviConnection =>
      KiviConnection.link({
        tenantId: '11111111-1111-4111-8111-111111111111',
        baseUrl: KiviBaseUrl.from('https://api.kivi.example'),
        connectionId: 'abc',
        secretRef: KiviSecretRef.from('KIVI_CONNECTION_TOKEN_STORE'),
      }),
    ).toThrow(InvalidKiviConnectionException);
  });

  it('becomes active after the initial load and records reconciliation', (): void => {
    const connection = link();
    const at = new Date('2026-10-27T00:00:00Z');
    connection.completeInitialLoad(at);
    expect(connection.getStatus()).toBe('active');
    expect(connection.getLastReconciledAt()).toEqual(at);
  });

  it('flags needs-reconcile and clears it only through a reconciliation', (): void => {
    const connection = link();
    connection.completeInitialLoad(new Date('2026-10-27T00:00:00Z'));
    connection.flagNeedsReconcile();
    expect(connection.getStatus()).toBe('needs_reconcile');
    connection.markReconciled(new Date('2026-10-28T00:00:00Z'));
    expect(connection.getStatus()).toBe('active');
  });

  it('is terminal once unlinked', (): void => {
    const connection = link();
    connection.unlink();
    expect(connection.isSyncing()).toBe(false);
    expect((): void => connection.flagNeedsReconcile()).toThrow(InvalidKiviConnectionException);
    expect((): void => connection.unlink()).toThrow(InvalidKiviConnectionException);
  });
});

describe('KiviConnection paired credential', (): void => {
  const encryptedToken = { ciphertext: 'v1.aaaa.bbbb', keyVersion: 1 };
  const paired = (): KiviConnection =>
    KiviConnection.pair({
      tenantId: '11111111-1111-4111-8111-111111111111',
      baseUrl: KiviBaseUrl.from('https://api.kivi.example'),
      connectionId: '22222222-2222-4222-8222-222222222222',
      encryptedToken,
    });

  it('starts pending with the ciphertext and no legacy secret reference', (): void => {
    const connection = paired();
    expect(connection.getStatus()).toBe('pending');
    expect(connection.getEncryptedToken()).toEqual(encryptedToken);
    expect(connection.getSecretRef()).toBeNull();
  });

  it('keeps legacy links free of ciphertext', (): void => {
    expect(link().getEncryptedToken()).toBeNull();
    expect(link().getSecretRef()?.getValue()).toBe('KIVI_CONNECTION_TOKEN_STORE');
  });

  it('wipes the ciphertext when unlinked', (): void => {
    const connection = paired();
    connection.unlink();
    expect(connection.getEncryptedToken()).toBeNull();
    expect(connection.getStatus()).toBe('unlinked');
  });

  it('rejects ids that are not uuids and empty ciphertext', (): void => {
    const base = {
      tenantId: '11111111-1111-4111-8111-111111111111',
      baseUrl: KiviBaseUrl.from('https://api.kivi.example'),
      connectionId: '22222222-2222-4222-8222-222222222222',
      encryptedToken,
    };
    expect((): KiviConnection => KiviConnection.pair({ ...base, connectionId: 'x' })).toThrow(
      InvalidKiviConnectionException,
    );
    expect((): KiviConnection =>
      KiviConnection.pair({ ...base, encryptedToken: { ciphertext: '', keyVersion: 1 } }),
    ).toThrow(InvalidKiviConnectionException);
  });
});

describe('KiviConnection invariant boundaries', (): void => {
  const props = (): Parameters<typeof KiviConnection.reconstitute>[0] => ({
    tenantId: '11111111-1111-4111-8111-111111111111',
    connectionId: '22222222-2222-4222-8222-222222222222',
    baseUrl: KiviBaseUrl.from('https://api.kivi.example'),
    secretRef: null,
    encryptedToken: { ciphertext: 'v1.aaaa.bbbb', keyVersion: 1 },
    status: 'active',
    lastReconciledAt: new Date('2026-10-27T00:00:00Z'),
  });

  it('copies incoming and returned credential envelopes', (): void => {
    const input = props();
    const connection = KiviConnection.reconstitute(input);
    Object.assign(input.encryptedToken!, { ciphertext: '' });
    expect(connection.getEncryptedToken()?.ciphertext).toBe('v1.aaaa.bbbb');
    Object.assign(connection.getEncryptedToken()!, { keyVersion: 0 });
    expect(connection.getEncryptedToken()?.keyVersion).toBe(1);
  });

  it('copies credentials accepted by the pairing factory', (): void => {
    const input = props();
    const connection = KiviConnection.pair({ ...input, encryptedToken: input.encryptedToken! });
    Object.assign(input.encryptedToken!, { ciphertext: '' });
    expect(connection.getEncryptedToken()?.ciphertext).toBe('v1.aaaa.bbbb');
  });

  it('isolates stored dates from input and getter mutations', (): void => {
    const input = props();
    const connection = KiviConnection.reconstitute(input);
    input.lastReconciledAt!.setUTCFullYear(2000);
    connection.getLastReconciledAt()!.setUTCFullYear(2001);
    expect(connection.getLastReconciledAt()?.toISOString()).toBe('2026-10-27T00:00:00.000Z');
    const completedAt = new Date('2026-10-28T00:00:00Z');
    connection.markReconciled(completedAt);
    completedAt.setUTCFullYear(2002);
    expect(connection.getLastReconciledAt()?.toISOString()).toBe('2026-10-28T00:00:00.000Z');
    const initialAt = new Date('2026-10-29T00:00:00Z');
    connection.completeInitialLoad(initialAt);
    initialAt.setUTCFullYear(2003);
    expect(connection.getLastReconciledAt()?.toISOString()).toBe('2026-10-29T00:00:00.000Z');
  });

  it.each([0, -1, 1.5, NaN, 32768])(
    'rejects invalid encryption key version %s',
    (keyVersion: number): void => {
      const input = props();
      expect((): KiviConnection =>
        KiviConnection.pair({
          ...input,
          encryptedToken: { ciphertext: 'v1.aaaa.bbbb', keyVersion },
        }),
      ).toThrow(InvalidKiviConnectionException);
    },
  );

  it('rejects invalid reconstituted identities and credential combinations', (): void => {
    const input = props();
    expect((): KiviConnection =>
      KiviConnection.reconstitute({ ...input, tenantId: 'invalid' }),
    ).toThrow(InvalidKiviConnectionException);
    expect((): KiviConnection =>
      KiviConnection.reconstitute({ ...input, encryptedToken: null }),
    ).toThrow(InvalidKiviConnectionException);
    expect((): KiviConnection =>
      KiviConnection.reconstitute({
        ...input,
        secretRef: KiviSecretRef.from('KIVI_CONNECTION_TOKEN_STORE'),
      }),
    ).toThrow(InvalidKiviConnectionException);
    expect((): KiviConnection =>
      KiviConnection.reconstitute({ ...input, status: 'unlinked' }),
    ).toThrow(InvalidKiviConnectionException);
    expect((): KiviConnection =>
      KiviConnection.reconstitute({ ...input, lastReconciledAt: new Date('invalid') }),
    ).toThrow(InvalidKiviConnectionException);
  });
});
