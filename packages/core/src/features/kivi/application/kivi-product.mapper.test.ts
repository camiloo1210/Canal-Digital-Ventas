import { describe, expect, it } from 'vitest';
import {
  toKiviProductPayload,
  kiviVersionOf,
  centsToDecimalString,
} from '@/kivi/application/kivi-product.mapper';
import type { KiviSourceProduct } from '@/kivi/application/ports/out/kivi-sync-store.port';

const product: KiviSourceProduct = {
  id: 'p1',
  tenantId: 't1',
  name: 'Cafe',
  priceCents: 350,
  currency: 'USD',
  wholesalePriceCents: 0,
  wholesaleMinQuantity: 0,
  description: 'Del dia',
  stock: 4,
  status: 'active',
  version: 0,
};

describe('kivi product mapping', (): void => {
  it.each([-1, NaN, Infinity, 1.5, 2147483648])(
    'rejects invalid cents %s',
    (cents: number): void => {
      expect((): string => centsToDecimalString(cents, 'USD')).toThrow();
    },
  );
  it('keeps the tenant currency without converting minor units', (): void => {
    expect(toKiviProductPayload({ ...product, currency: 'COP' })).toMatchObject({
      currency: 'COP',
      price: '3.50',
    });
  });
  it('formats CLP (exponent 0) and USD (exponent 2) from the same minor units', (): void => {
    expect(centsToDecimalString(5000, 'CLP')).toBe('5000');
    expect(centsToDecimalString(5000, 'USD')).toBe('50.00');
    expect(toKiviProductPayload({ ...product, currency: 'CLP', priceCents: 5000 }).price).toBe(
      '5000',
    );
  });
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

  it('sends the wholesale offer as an exact decimal and minimum quantity', (): void => {
    const offer = toKiviProductPayload({
      ...product,
      wholesalePriceCents: 275,
      wholesaleMinQuantity: 12,
    });
    expect(offer).toMatchObject({ wholesale_price: '2.75', wholesale_min_quantity: 12 });
  });

  it('sends explicit nulls when there is no complete wholesale offer so Kivi clears it', (): void => {
    expect(toKiviProductPayload(product)).toMatchObject({
      wholesale_price: null,
      wholesale_min_quantity: null,
    });
    expect(
      toKiviProductPayload({ ...product, wholesalePriceCents: 275, wholesaleMinQuantity: 0 }),
    ).toMatchObject({ wholesale_price: null, wholesale_min_quantity: null });
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

  it('sends the product photos, and an explicit empty list when there are none', (): void => {
    const urls = [1, 2, 3, 4, 5, 6].map((n: number): string => `https://cdn.example.com/${n}.jpg`);
    expect(toKiviProductPayload({ ...product, imageUrls: urls }).image_urls).toEqual(
      urls.slice(0, 5),
    );
    expect(toKiviProductPayload(product).image_urls).toEqual([]);
  });
});
