import { describe, it, expect, vi } from 'vitest';
import { GenerateBusinessAdviceUseCase } from '@/dashboard/application/use-cases/generate-business-advice.use-case';
import { buildAdvisorDigest } from '@/dashboard/application/business-advisor-digest';
import { BusinessAdviceAccessDeniedException } from '@/dashboard/application/exceptions/business-advisor.exception';
import {
  analyzeBusinessIntelligence,
  type IntelligenceSnapshot,
} from '@/dashboard/domain/business-intelligence';

const query = { days: 7, leadTimeDays: 7, targetCoverageDays: 30 };
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
      stock: 50,
      costCents: 200,
      priceCents: 250,
      status: 'active',
      hasVariants: false,
    },
  ],
  orders: [
    {
      id: 'o1',
      createdAt: '2026-10-24T12:00:00Z',
      currency: 'USD',
      discountCents: 0,
      items: [{ productId: 'a', quantity: 7, subtotalCents: 2100 }],
    },
  ],
  flowOrders: [],
};
const report = analyzeBusinessIntelligence(snapshot, query);

describe('advisor digest', (): void => {
  it('keeps aggregates and product facts, and nothing that identifies buyers', (): void => {
    const digest = buildAdvisorDigest(report, 'es');
    expect(digest.totals.revenueCents).toBe(2100);
    expect(digest.topByRevenue[0]).toMatchObject({ name: 'Coffee', unitsSold: 7 });
    expect(digest.slowMovers.map((item): string => item.name)).toEqual(['Tea']);
    expect(digest.revenueByWeekday).toHaveLength(7);
    // 2026-10-24 is a Saturday.
    expect(digest.revenueByWeekday[6].revenueCents).toBe(2100);
    const serialized = JSON.stringify(digest);
    for (const secret of ['"id"', 'sku', 'customer', 'email', 'orderNumber'])
      expect(serialized).not.toContain(secret);
  });
});

describe('GenerateBusinessAdviceUseCase', (): void => {
  const advice = {
    summary: 'ok',
    tips: [{ category: 'promotions' as const, title: 't', detail: 'd' }],
  };
  it('passes the authenticated actor to the read port and the digest to the advisor', async (): Promise<void> => {
    const findForManager = vi.fn().mockResolvedValue(report);
    const advise = vi.fn().mockResolvedValue(advice);
    const result = await new GenerateBusinessAdviceUseCase({ findForManager }, { advise }).execute({
      authenticatedUserId: 'user',
      tenantId: 'tenant',
      ...query,
      locale: 'en',
    });
    expect(result).toBe(advice);
    expect(findForManager).toHaveBeenCalledWith('user', 'tenant', query);
    expect(advise).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en', currency: 'USD' }));
  });
  it('never calls the advisor when the actor cannot see the report', async (): Promise<void> => {
    const advise = vi.fn();
    await expect(
      new GenerateBusinessAdviceUseCase(
        { findForManager: vi.fn().mockResolvedValue(null) },
        { advise },
      ).execute({ authenticatedUserId: 'x', tenantId: 'tenant', ...query, locale: 'es' }),
    ).rejects.toBeInstanceOf(BusinessAdviceAccessDeniedException);
    expect(advise).not.toHaveBeenCalled();
  });
  it('reconstructs a custom range from primitive input fields', async (): Promise<void> => {
    const findForManager = vi.fn().mockResolvedValue(report);
    const advise = vi.fn().mockResolvedValue(advice);
    await new GenerateBusinessAdviceUseCase({ findForManager }, { advise }).execute({
      authenticatedUserId: 'user',
      tenantId: 'tenant',
      ...query,
      endDate: '2026-10-24',
      locale: 'es',
    });
    expect(findForManager).toHaveBeenCalledWith('user', 'tenant', {
      ...query,
      endDate: '2026-10-24',
    });
  });
});
