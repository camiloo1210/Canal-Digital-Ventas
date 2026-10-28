import { describe, expect, it } from 'vitest';
import { toKiviProductPayload, kiviVersionOf } from '@/kivi/application/kivi-product.mapper';
import type { KiviSourceProduct } from '@/kivi/application/ports/out/kivi-sync-store.port';

const product: KiviSourceProduct = {
  id: 'p1',
  tenantId: 't1',
  name: 'Cafe',
  priceCents: 350,
  description: 'Del dia',
  stock: 4,
  status: 'active',
  version: 0,
};

describe('kivi product mapping', (): void => {
  it('shifts the persisted version so it is a positive integer and strictly increasing', (): void => {
    expect(kiviVersionOf(product)).toBe(1);
    expect(kiviVersionOf({ ...product, version: 7 })).toBe(8);
  });

  it('adds the persisted per-product offset so versions stay monotonic after a bump', (): void => {
    expect(kiviVersionOf({ ...product, version: 4, kiviVersionOffset: 47 })).toBe(52);
    expect(toKiviProductPayload({ ...product, version: 3, kiviVersionOffset: 47 }).version).toBe(
      51,
    );
    expect(kiviVersionOf({ ...product, version: 7 })).toBe(8);
  });

  it('maps minor units to an exact decimal string without float math', (): void => {
    expect(toKiviProductPayload(product).price).toBe('3.50');
    expect(toKiviProductPayload({ ...product, priceCents: 5 }).price).toBe('0.05');
    expect(toKiviProductPayload({ ...product, priceCents: 1000000 }).price).toBe('10000.00');
  });

  it('derives availability from status and stock', (): void => {
    expect(toKiviProductPayload(product)).toMatchObject({ is_available: true, is_orderable: true });
    expect(toKiviProductPayload({ ...product, stock: 0, status: 'out_of_stock' })).toMatchObject({
      is_available: true,
      is_orderable: false,
    });
    expect(toKiviProductPayload({ ...product, status: 'inactive' })).toMatchObject({
      is_available: false,
      is_orderable: false,
    });
  });
});
