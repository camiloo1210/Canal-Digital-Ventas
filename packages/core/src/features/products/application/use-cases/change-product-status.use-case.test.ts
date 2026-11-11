import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryProductRepository } from '@/testing/in-memory/in-memory-product.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { FakeTransactionManager } from '@/testing/fakes/fake-transaction-manager';
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

import { ChangeProductStatusUseCase } from '@/products/application/use-cases/change-product-status.use-case';
import { InvalidProductStateException } from '@/products/domain/exceptions/invalid-product-state.exception';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';

function setup(): {
  repo: InMemoryProductRepository;
  bus: FakeEventBus;
  useCase: ChangeProductStatusUseCase;
} {
  const repo = new InMemoryProductRepository();
  const bus = new FakeEventBus();
  return {
    repo,
    bus,
    useCase: new ChangeProductStatusUseCase(repo, bus, new FakeTransactionManager()),
  };
}

describe('ChangeProductStatusUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });
  it('changes an active product to inactive and saves it', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, status: 'inactive' });

    const product = await stored(repo);
    expect(product?.getStatus()).toBe(ProductStatus.INACTIVE);
    expect(product?.getVersion()).toBe(1);
    expect(repo.saveCount).toBe(1);
  });

  it('publishes ProductDetailsChangedEvent so Kivi re-syncs availability', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, status: 'inactive' });

    expect(bus.publishedLegacy).toHaveLength(0);
    expect(bus.published.map((envelope): string => envelope.event.eventName)).toEqual([
      'ProductDetailsChangedEvent',
    ]);
  });

  it.each([
    { name: 'activating with stock 0', stock: 0, from: ProductStatus.INACTIVE, to: 'active' },
    {
      name: 'out_of_stock with stock > 0',
      stock: 5,
      from: ProductStatus.ACTIVE,
      to: 'out_of_stock',
    },
    { name: 'archived via status change', stock: 5, from: ProductStatus.ACTIVE, to: 'archived' },
    { name: 'leaving archived', stock: 5, from: ProductStatus.ARCHIVED, to: 'active' },
  ])(
    'rejects $name with InvalidProductStateException and saves nothing',
    async ({ stock, from, to }): Promise<void> => {
      const { repo, useCase } = setup();
      repo.seed(buildProduct({ stock, status: from }));

      await expect((): Promise<void> =>
        useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, status: to }),
      ).rejects.toBeInstanceOf(InvalidProductStateException);
      expect((await stored(repo))?.getStatus()).toBe(from);
      expect(repo.saveCount).toBe(0);
    },
  );

  it('rejects an unknown status string with InvalidProductAttributeException', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<void> =>
      useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, status: 'bogus' }),
    ).rejects.toBeInstanceOf(InvalidProductAttributeException);
    expect(repo.saveCount).toBe(0);
  });

  it('throws ProductNotFoundException for an unknown id', async (): Promise<void> => {
    const { repo, useCase } = setup();

    await expect((): Promise<void> =>
      useCase.execute({ productId: 'missing', tenantId: TENANT, status: 'inactive' }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(repo.saveCount).toBe(0);
  });

  it("treats another tenant's product as not found and writes nothing", async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<void> =>
      useCase.execute({ productId: PRODUCT_ID, tenantId: OTHER_TENANT, status: 'inactive' }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect((await stored(repo))?.getStatus()).toBe(ProductStatus.ACTIVE);
    expect(repo.saveCount).toBe(0);
  });
});
