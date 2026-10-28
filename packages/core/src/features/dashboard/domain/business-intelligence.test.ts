import { describe, it, expect } from 'vitest';
import {
  analyzeBusinessIntelligence,
  type IntelligenceSnapshot,
} from '@/dashboard/domain/business-intelligence';

const query = { days: 7 as const, leadTimeDays: 7, targetCoverageDays: 30 };
const snapshot: IntelligenceSnapshot = {
  observedAt: '2026-10-25T12:00:00.000Z',
  currency: 'USD',
  products: [
    {
      id: 'a',
      name: 'Coffee',
      sku: 'A',
      category: 'Drinks',
      stock: 2,
      costCents: 100,
      priceCents: 300,
      status: 'active',
      hasVariants: false,
    },
    {
      id: 'b',
      name: 'Tea',
      sku: 'B',
      category: 'Drinks',
      stock: 12,
      costCents: 200,
      priceCents: 100,
      status: 'active',
      hasVariants: false,
    },
  ],
  orders: [
    {
      id: 'sale',
      createdAt: '2026-10-24T12:00:00Z',
      discountCents: 1,
      items: [
        { productId: 'a', quantity: 7, subtotalCents: 2100 },
        { productId: 'b', quantity: 1, subtotalCents: 100 },
      ],
    },
    {
      id: 'previous',
      createdAt: '2026-10-17T12:00:00Z',
      discountCents: 0,
      items: [{ productId: 'a', quantity: 1, subtotalCents: 300 }],
    },
  ],
};

describe('business intelligence policy', (): void => {
  it('ranks by the selected measure rather than confusing expensive products with high demand', (): void => {
    const report = analyzeBusinessIntelligence(
      {
        ...snapshot,
        orders: [
          {
            id: 'ranking',
            createdAt: '2026-10-24T12:00:00Z',
            discountCents: 0,
            items: [
              { productId: 'a', quantity: 2, subtotalCents: 200 },
              { productId: 'b', quantity: 1, subtotalCents: 1000 },
            ],
          },
        ],
      },
      query,
    );
    expect(report.productRankings.revenue.map((product): string => product.id)).toEqual(['b', 'a']);
    expect(report.productRankings.units.map((product): string => product.id)).toEqual(['a', 'b']);
  });
  it('aligns prior-period daily sales and computes chart metrics in Core', (): void => {
    const report = analyzeBusinessIntelligence(snapshot, query);
    expect(report.daily[6]).toMatchObject({
      date: '2026-10-24',
      previousDate: '2026-10-17',
      revenueCents: 2199,
      previousRevenueCents: 300,
      estimatedProfitCents: 1299,
      previousEstimatedProfitCents: 200,
      unitsSold: 8,
      previousUnitsSold: 1,
    });
    expect(report.daily[0]).toMatchObject({
      revenueCents: 0,
      previousRevenueCents: 0,
      unitsSold: 0,
    });
    expect(report.productRankings.revenue.map((product): string => product.id)).toEqual(['a', 'b']);
    expect(report.productRankings.units.map((product): string => product.id)).toEqual(['a', 'b']);
  });
  it('prioritizes stockouts and shortest coverage ahead of raw stock counts', (): void => {
    const report = analyzeBusinessIntelligence(
      {
        ...snapshot,
        products: [
          { ...snapshot.products[0], id: 'slow', stock: 1 },
          { ...snapshot.products[0], id: 'fast', stock: 20 },
          { ...snapshot.products[0], id: 'empty', stock: 0 },
        ],
        orders: [
          {
            id: 'sale',
            createdAt: '2026-10-24T12:00:00Z',
            discountCents: 0,
            items: [
              { productId: 'slow', quantity: 1, subtotalCents: 300 },
              { productId: 'fast', quantity: 140, subtotalCents: 42000 },
            ],
          },
        ],
      },
      query,
    );
    expect(report.priorities.map((product): string => product.id)).toEqual([
      'empty',
      'fast',
      'slow',
    ]);
  });
  it('caps merchandise discounts at merchandise value without rejecting valid order-level discounts', (): void => {
    const report = analyzeBusinessIntelligence(
      {
        ...snapshot,
        orders: [
          {
            id: 'shipping-discount',
            createdAt: '2026-10-24T12:00:00Z',
            discountCents: 150,
            items: [{ productId: 'a', quantity: 1, subtotalCents: 100 }],
          },
          {
            id: 'free-merchandise',
            createdAt: '2026-10-24T12:00:00Z',
            discountCents: 50,
            items: [{ productId: 'b', quantity: 1, subtotalCents: 0 }],
          },
        ],
      },
      query,
    );
    expect(report.revenueCents).toBe(0);
    expect(report.estimatedProfitCents).toBe(-300);
    expect(report.orderCount).toBe(2);
    expect(report.products.map((product): number => product.revenueCents)).toEqual([0, 0]);
    expect(report.marginBps).toBeNull();
  });
  it('deducts discounts exactly and estimates profit using current costs', (): void => {
    const report = analyzeBusinessIntelligence(snapshot, query);
    expect(report.revenueCents).toBe(2199);
    expect(report.estimatedProfitCents).toBe(1299);
    expect(report.unitsSold).toBe(8);
    expect(report.orderCount).toBe(1);
    expect(report.previousRevenueCents).toBe(300);
    expect(report.revenueChangeBps).toBe(63300);
    expect(report.products.reduce((sum: number, p): number => sum + p.revenueCents, 0)).toBe(2199);
    expect(report.products.find((p): boolean => p.id === 'b')?.estimatedProfitCents).toBeLessThan(
      0,
    );
  });
  it('computes days of cover and restock quantity from adjustable assumptions', (): void => {
    const product = analyzeBusinessIntelligence(snapshot, query).products[0];
    expect(product.id).toBe('a');
    expect(product.coverageDays).toBe(2);
    expect(product.restockUnits).toBe(28);
    expect(product.signal).toBe('restock');
    expect(
      analyzeBusinessIntelligence(snapshot, { ...query, leadTimeDays: 1 }).products[0].signal,
    ).toBe('healthy');
  });
  it('keeps no-sales, stockouts and missing comparisons honest', (): void => {
    const report = analyzeBusinessIntelligence(
      {
        ...snapshot,
        orders: [],
        products: snapshot.products.map((p): typeof p => ({ ...p, stock: 0 })),
      },
      query,
    );
    expect(report.revenueChangeBps).toBeNull();
    expect(report.marginBps).toBeNull();
    expect(report.products[0].coverageDays).toBeNull();
    expect(report.products[0].signal).toBe('outOfStock');
    expect(report.products[0].restockUnits).toBe(0);
    expect(report.daily).toHaveLength(7);
    expect(report.daily[0].date).toBe('2026-10-18');
    expect(report.daily[6].date).toBe('2026-10-24');
  });
  it('excludes today and the earlier boundary, retaining all complete UTC days', (): void => {
    const report = analyzeBusinessIntelligence(
      {
        ...snapshot,
        orders: [
          ...snapshot.orders,
          {
            id: 'today',
            createdAt: '2026-10-25T00:00:00Z',
            discountCents: 0,
            items: [{ productId: 'a', quantity: 99, subtotalCents: 9999 }],
          },
          {
            id: 'old',
            createdAt: '2026-10-10T23:59:59Z',
            discountCents: 0,
            items: [{ productId: 'a', quantity: 99, subtotalCents: 9999 }],
          },
        ],
      },
      query,
    );
    expect(report.revenueCents).toBe(2199);
    expect(report.previousRevenueCents).toBe(300);
  });
  it('does not recommend purchasing archived products or pretend variant coverage is known', (): void => {
    const report = analyzeBusinessIntelligence(
      {
        ...snapshot,
        products: snapshot.products.map((p): typeof p => ({
          ...p,
          hasVariants: p.id === 'a',
          status: p.id === 'b' ? 'archived' : 'active',
        })),
      },
      query,
    );
    expect(report.products.find((p): boolean => p.id === 'a')).toMatchObject({
      signal: 'variants',
      restockUnits: 0,
      coverageDays: null,
    });
    expect(report.products.find((p): boolean => p.id === 'b')).toMatchObject({
      signal: 'inactive',
      restockUnits: 0,
    });
  });
  it('rejects unsafe monetary values and invalid scenario options', (): void => {
    expect((): unknown =>
      analyzeBusinessIntelligence(snapshot, { ...query, leadTimeDays: 0 }),
    ).toThrow();
    expect((): unknown =>
      analyzeBusinessIntelligence(
        {
          ...snapshot,
          products: [{ ...snapshot.products[0], costCents: Number.MAX_SAFE_INTEGER + 1 }],
        },
        query,
      ),
    ).toThrow();
  });
});
