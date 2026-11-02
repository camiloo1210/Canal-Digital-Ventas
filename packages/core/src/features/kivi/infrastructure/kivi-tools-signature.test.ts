import { describe, expect, it } from 'vitest';
import { deriveKiviOrderLookupKey } from '@/kivi/infrastructure/kivi-order-lookup-signature';
import {
  deriveKiviToolsKey,
  signKiviTools,
  verifyKiviToolsSignature,
  type KiviToolsSignatureInput,
} from '@/kivi/infrastructure/kivi-tools-signature';

const MASTER = Buffer.alloc(32, 9);
const TENANT = '11111111-1111-4111-8111-111111111111';
const BODY = `{"tenantId":"${TENANT}","tool":"get_product_details","arguments":{"query":"cafe"}}`;
const NOW = 1_800_000_000;

function valid(): KiviToolsSignatureInput {
  const timestamp = String(NOW);
  return {
    masterKey: MASTER,
    tenantId: TENANT,
    timestamp,
    rawBody: BODY,
    signature: signKiviTools(MASTER, TENANT, timestamp, BODY),
    nowSeconds: NOW,
  };
}

describe('deriveKiviToolsKey', (): void => {
  it('matches an independently computed vector (master = 32 bytes of 0x07)', (): void => {
    expect(deriveKiviToolsKey(Buffer.alloc(32, 7), '11111111-2222-3333-4444-555555555555')).toBe(
      '04aa5163572385a40f2c856c10d1418bf83fd2baee9ef55e13454d2ada2f30ba',
    );
  });

  it('signs timestamp.body with the derived key (fixed vector)', (): void => {
    expect(
      signKiviTools(
        Buffer.alloc(32, 7),
        '11111111-2222-3333-4444-555555555555',
        '1800000000',
        '{"a":1}',
      ),
    ).toBe('0f1caa48acb90a21b60aba5908c620fe5d9d43a59f47b74c454a7ba077d0b8b9');
  });

  it('is domain-separated from the order-lookup key', (): void => {
    expect(deriveKiviToolsKey(MASTER, TENANT)).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveKiviToolsKey(MASTER, TENANT)).not.toBe(deriveKiviOrderLookupKey(MASTER, TENANT));
  });
});

describe('verifyKiviToolsSignature', (): void => {
  it('accepts a valid signature and the +-300 s window edges', (): void => {
    expect(verifyKiviToolsSignature(valid())).toBe(true);
    expect(verifyKiviToolsSignature({ ...valid(), nowSeconds: NOW + 300 })).toBe(true);
    expect(verifyKiviToolsSignature({ ...valid(), nowSeconds: NOW - 300 })).toBe(true);
  });

  it('rejects outside the window, tampering, other tenant, other key and malformed input', (): void => {
    const base = valid();
    expect(verifyKiviToolsSignature({ ...base, nowSeconds: NOW + 301 })).toBe(false);
    expect(verifyKiviToolsSignature({ ...base, rawBody: BODY + ' ' })).toBe(false);
    expect(
      verifyKiviToolsSignature({ ...base, tenantId: '22222222-2222-4222-8222-222222222222' }),
    ).toBe(false);
    expect(verifyKiviToolsSignature({ ...base, masterKey: Buffer.alloc(32, 1) })).toBe(false);
    expect(verifyKiviToolsSignature({ ...base, masterKey: Buffer.alloc(16, 9) })).toBe(false);
    expect(verifyKiviToolsSignature({ ...base, signature: base.signature.toUpperCase() })).toBe(
      false,
    );
    expect(verifyKiviToolsSignature({ ...base, signature: 'abc' })).toBe(false);
    expect(verifyKiviToolsSignature({ ...base, timestamp: '12abc' })).toBe(false);
  });

  it('rejects an order-lookup signature (different context)', (): void => {
    const base = valid();
    const lookupSignature = signKiviTools(Buffer.alloc(32, 9), 'x', base.timestamp, BODY);
    expect(verifyKiviToolsSignature({ ...base, signature: lookupSignature })).toBe(false);
  });
});
