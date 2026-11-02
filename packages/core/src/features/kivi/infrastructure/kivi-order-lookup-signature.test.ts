import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  deriveKiviOrderLookupKey,
  signKiviOrderLookup,
  verifyKiviOrderLookupSignature,
  type KiviOrderLookupSignatureInput,
} from '@/kivi/infrastructure/kivi-order-lookup-signature';

const MASTER = Buffer.alloc(32, 9);
const TENANT = '11111111-1111-4111-8111-111111111111';
const BODY = `{"tenantId":"${TENANT}","phone":"573001112233","orderNumber":null}`;
const NOW = 1_800_000_000;

function valid(): KiviOrderLookupSignatureInput {
  const timestamp = String(NOW);
  return {
    masterKey: MASTER,
    tenantId: TENANT,
    timestamp,
    rawBody: BODY,
    signature: signKiviOrderLookup(MASTER, TENANT, timestamp, BODY),
    nowSeconds: NOW,
  };
}

describe('deriveKiviOrderLookupKey', (): void => {
  it('matches an independently computed vector (master = 32 bytes of 0x07)', (): void => {
    expect(
      deriveKiviOrderLookupKey(Buffer.alloc(32, 7), '11111111-2222-3333-4444-555555555555'),
    ).toBe('8a258886a0e5eede0888db80b9d8add009dd5b57a63d1ae8651f9ef3752cf948');
  });

  it('is deterministic, 64 lowercase hex and differs per tenant and master', (): void => {
    const a = deriveKiviOrderLookupKey(MASTER, TENANT);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveKiviOrderLookupKey(MASTER, TENANT)).toBe(a);
    expect(deriveKiviOrderLookupKey(MASTER, '22222222-2222-4222-8222-222222222222')).not.toBe(a);
    expect(deriveKiviOrderLookupKey(Buffer.alloc(32, 1), TENANT)).not.toBe(a);
  });

  it('signs with the hex-decoded derived key, as Kivi does', (): void => {
    const key = Buffer.from(deriveKiviOrderLookupKey(MASTER, TENANT), 'hex');
    const expected = createHmac('sha256', key).update(`${NOW}.${BODY}`).digest('hex');
    expect(signKiviOrderLookup(MASTER, TENANT, String(NOW), BODY)).toBe(expected);
  });
});

describe('kivi order lookup signature', (): void => {
  it('accepts a valid signature', (): void => {
    expect(verifyKiviOrderLookupSignature(valid())).toBe(true);
  });
  it('rejects a tampered body', (): void => {
    expect(verifyKiviOrderLookupSignature({ ...valid(), rawBody: `${BODY} ` })).toBe(false);
  });
  it('rejects another tenant id', (): void => {
    expect(
      verifyKiviOrderLookupSignature({
        ...valid(),
        tenantId: '22222222-2222-4222-8222-222222222222',
      }),
    ).toBe(false);
  });
  it('rejects stale and future timestamps', (): void => {
    for (const timestamp of [String(NOW - 301), String(NOW + 301)]) {
      expect(
        verifyKiviOrderLookupSignature({
          ...valid(),
          timestamp,
          signature: signKiviOrderLookup(MASTER, TENANT, timestamp, BODY),
        }),
      ).toBe(false);
    }
  });
  it('rejects wrong-length, uppercase and non-hex signatures', (): void => {
    const sig = valid().signature;
    expect(verifyKiviOrderLookupSignature({ ...valid(), signature: sig.slice(2) })).toBe(false);
    expect(verifyKiviOrderLookupSignature({ ...valid(), signature: sig.toUpperCase() })).toBe(
      false,
    );
    expect(verifyKiviOrderLookupSignature({ ...valid(), signature: 'zz' })).toBe(false);
  });
  it('rejects an unusable master key', (): void => {
    expect(verifyKiviOrderLookupSignature({ ...valid(), masterKey: Buffer.alloc(5) })).toBe(false);
  });
});
