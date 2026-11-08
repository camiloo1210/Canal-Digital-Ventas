import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryProductRepository } from '@/testing/in-memory/in-memory-product.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildProduct } from '@/testing/builders/product.builder';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import type { Product } from '@/products/domain/entities/product.entity';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const PRODUCT_ID = 'product-1';
const NOW = new Date('2026-01-15T12:00:00.000Z');

function stored(repo: InMemoryProductRepository, tenant: string = TENANT): Promise<Product | null> {
  return repo.findById(createProductId(PRODUCT_ID), createTenantId(tenant));
}

import { ChangeProductPricingUseCase } from '@/products/application/use-cases/change-product-pricing.use-case';
import { ProductPricingChangedEvent } from '@/products/domain/events/product-pricing-changed.event';
import { InvalidWholesaleRulesException } from '@/products/domain/exceptions/invalid-wholesale-rules.exception';
import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';
import { Currency } from '@/shared/domain/enums/currency.enum';

function setup(): {
  repo: InMemoryProductRepository;
  bus: FakeEventBus;
  useCase: ChangeProductPricingUseCase;
} {
  const repo = new InMemoryProductRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new ChangeProductPricingUseCase(repo, bus) };
}

describe('ChangeProductPricingUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });
  it('updates price and cost in the product currency and clears wholesale when omitted', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, price: 2500, cost: 1200 });

    const product = await stored(repo);
    expect(product?.getPrice().getValue()).toBe(2500);
    expect(product?.getPrice().getCurrency()).toBe(Currency.COP);
    expect(product?.getCost().getValue()).toBe(1200);
    expect(product?.getWholesalePrice().getValue()).toBe(0);
    expect(product?.getWholesaleMinQuantity()).toBe(0);
    expect(repo.saveCount).toBe(1);
  });

  it('stores wholesale rules and publishes pricing events', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute({
      productId: PRODUCT_ID,
      tenantId: TENANT,
      price: 2500,
      cost: 1200,
      wholesalePrice: 2000,
      wholesaleMinQuantity: 12,
    });

    const product = await stored(repo);
    expect(product?.getWholesalePrice().getValue()).toBe(2000);
    expect(product?.getWholesaleMinQuantity()).toBe(12);
    expect(bus.publishedLegacy.length).toBeGreaterThan(0);
    expect(
      bus.publishedLegacy.every((event): boolean => event instanceof ProductPricingChangedEvent),
    ).toBe(true);
  });

  it('rejects a wholesale price without a minimum quantity and saves nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<void> =>
      useCase.execute({
        productId: PRODUCT_ID,
        tenantId: TENANT,
        price: 2500,
        cost: 1200,
        wholesalePrice: 2000,
      }),
    ).rejects.toBeInstanceOf(InvalidWholesaleRulesException);
    expect((await stored(repo))?.getPrice().getValue()).toBe(10);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it.each([
    { name: 'a negative price', price: -1 },
    { name: 'a fractional price', price: 10.5 },
  ])(
    'rejects $name with InvalidMoneyException and saves nothing',
    async ({ price }): Promise<void> => {
      const { repo, useCase } = setup();
      repo.seed(buildProduct());

      await expect((): Promise<void> =>
        useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, price, cost: 1 }),
      ).rejects.toBeInstanceOf(InvalidMoneyException);
      expect(repo.saveCount).toBe(0);
    },
  );

  it('throws ProductNotFoundException for an unknown id', async (): Promise<void> => {
    const { repo, useCase } = setup();

    await expect((): Promise<void> =>
      useCase.execute({ productId: 'missing', tenantId: TENANT, price: 1, cost: 1 }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(repo.saveCount).toBe(0);
  });

  it("treats another tenant's product as not found and writes nothing", async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<void> =>
      useCase.execute({ productId: PRODUCT_ID, tenantId: OTHER_TENANT, price: 1, cost: 1 }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect((await stored(repo))?.getPrice().getValue()).toBe(10);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });
});
