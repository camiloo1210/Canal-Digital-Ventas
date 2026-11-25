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

import { ChangeProductDetailsUseCase } from '@/products/application/use-cases/change-product-details.use-case';
import { ProductDetailsChangedEvent } from '@/products/domain/events/product-details-changed.event';
import { InvalidSkuException } from '@/products/domain/exceptions/invalid-sku.exception';
import { InvalidProductNameException } from '@/products/domain/exceptions/invalid-product-name.exception';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
import type { ChangeProductDetailsDto } from '@/products/application/dtos/change-product-details.dto';

function dto(overrides: Partial<ChangeProductDetailsDto> = {}): ChangeProductDetailsDto {
  return {
    productId: PRODUCT_ID,
    tenantId: TENANT,
    name: '  New name ',
    description: 'New description',
    categoryId: 'category-2',
    sku: 'new-sku-1',
    seasonIds: ['season-1'],
    isVatExempt: true,
    ...overrides,
  };
}

function setup(): {
  repo: InMemoryProductRepository;
  bus: FakeEventBus;
  useCase: ChangeProductDetailsUseCase;
} {
  const repo = new InMemoryProductRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new ChangeProductDetailsUseCase(repo, bus) };
}

describe('ChangeProductDetailsUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });
  it('applies normalized details, saves and publishes ProductDetailsChangedEvent', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute(dto());

    const product = await stored(repo);
    expect(product?.getName()).toBe('New name');
    expect(product?.getSku()).toBe('NEW-SKU-1');
    expect(product?.getCategory()).toBe('category-2');
    expect(product?.getDescription()).toBe('New description');
    expect(product?.getSeasonIds()).toEqual(['season-1']);
    expect(product?.getIsVatExempt()).toBe(true);
    expect(product?.getVersion()).toBe(1);
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(ProductDetailsChangedEvent);
  });

  it('throws ProductNotFoundException for an unknown id', async (): Promise<void> => {
    const { repo, useCase } = setup();

    await expect((): Promise<void> =>
      useCase.execute(dto({ productId: 'missing' })),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(repo.saveCount).toBe(0);
  });

  it("treats another tenant's product as not found and writes nothing", async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<void> =>
      useCase.execute(dto({ tenantId: OTHER_TENANT })),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect((await stored(repo))?.getName()).toBe('Test product');
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it.each([
    { name: 'an invalid sku', overrides: { sku: 'x' }, error: InvalidSkuException },
    { name: 'an empty name', overrides: { name: '   ' }, error: InvalidProductNameException },
    {
      name: 'a description over 200 characters',
      overrides: { description: 'd'.repeat(201) },
      error: InvalidProductAttributeException,
    },
    {
      name: 'an empty category',
      overrides: { categoryId: '' },
      error: InvalidProductAttributeException,
    },
  ])(
    'propagates the domain exception for $name and saves nothing',
    async ({ overrides, error }): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildProduct());

      await expect((): Promise<void> => useCase.execute(dto(overrides))).rejects.toBeInstanceOf(
        error,
      );
      expect((await stored(repo))?.getName()).toBe('Test product');
      expect(repo.saveCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
    },
  );
});
