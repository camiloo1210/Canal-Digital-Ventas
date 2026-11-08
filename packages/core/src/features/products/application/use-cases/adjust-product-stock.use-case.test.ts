import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryProductRepository } from '@/testing/in-memory/in-memory-product.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildProduct } from '@/testing/builders/product.builder';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import type { Product } from '@/products/domain/entities/product.entity';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const PRODUCT_ID = 'product-1';
const NOW = new Date('2026-01-15T12:00:00.000Z');

function stored(repo: InMemoryProductRepository, tenant: string = TENANT): Promise<Product | null> {
  return repo.findById(createProductId(PRODUCT_ID), createTenantId(tenant));
}

import { AdjustProductStockUseCase } from '@/products/application/use-cases/adjust-product-stock.use-case';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
import { ProductStockAdjustedEvent } from '@/products/domain/events/product-stock-adjusted.event';

function setup(): {
  repo: InMemoryProductRepository;
  bus: FakeEventBus;
  useCase: AdjustProductStockUseCase;
} {
  const repo = new InMemoryProductRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new AdjustProductStockUseCase(repo, bus) };
}

describe('AdjustProductStockUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });
  it('stores the new stock and publishes ProductStockAdjustedEvent', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, stock: 25 });

    const product = await stored(repo);
    expect(product?.getStock()).toBe(25);
    expect(product?.getVersion()).toBe(1);
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(ProductStockAdjustedEvent);
    expect(bus.publishedLegacy[0]).toMatchObject({ productId: PRODUCT_ID, stock: 25 });
  });

  it('moves an active product to OUT_OF_STOCK when stock reaches zero', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, stock: 0 });

    expect((await stored(repo))?.getStatus()).toBe(ProductStatus.OUT_OF_STOCK);
  });

  it('reactivates an OUT_OF_STOCK product when stock becomes positive', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct({ stock: 0, status: ProductStatus.OUT_OF_STOCK }));

    await useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, stock: 4 });

    expect((await stored(repo))?.getStatus()).toBe(ProductStatus.ACTIVE);
  });

  it('throws ProductNotFoundException for an unknown id', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();

    await expect((): Promise<void> =>
      useCase.execute({ productId: 'missing', tenantId: TENANT, stock: 1 }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it("treats another tenant's product as not found and writes nothing", async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<void> =>
      useCase.execute({ productId: PRODUCT_ID, tenantId: OTHER_TENANT, stock: 99 }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect((await stored(repo))?.getStock()).toBe(10);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('propagates the domain exception for negative stock and saves nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<void> =>
      useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, stock: -1 }),
    ).rejects.toBeInstanceOf(InvalidProductAttributeException);
    expect((await stored(repo))?.getStock()).toBe(10);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });
});
