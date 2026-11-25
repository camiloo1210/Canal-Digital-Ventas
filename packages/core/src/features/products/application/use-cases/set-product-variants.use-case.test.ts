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

import { SetProductVariantsUseCase } from '@/products/application/use-cases/set-product-variants.use-case';
import { InvalidSkuException } from '@/products/domain/exceptions/invalid-sku.exception';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
import type { SetProductVariantsDto } from '@/products/application/dtos/set-product-variants.dto';

type VariantInput = SetProductVariantsDto['variants'][number];

function variant(overrides: Partial<VariantInput> = {}): VariantInput {
  return {
    id: 'variant-1',
    sku: 'VAR-00001',
    name: 'Large',
    attributes: { size: 'L' },
    stock: 3,
    ...overrides,
  };
}

function setup(): {
  repo: InMemoryProductRepository;
  bus: FakeEventBus;
  useCase: SetProductVariantsUseCase;
} {
  const repo = new InMemoryProductRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new SetProductVariantsUseCase(repo, bus) };
}

describe('SetProductVariantsUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });
  it('replaces the variants, derives their status and flags the product', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute({
      productId: PRODUCT_ID,
      tenantId: TENANT,
      variants: [
        variant({ priceOverride: 1500 }),
        variant({ id: 'variant-2', sku: 'VAR-00002', name: 'Small', stock: 0 }),
      ],
    });

    const product = await stored(repo);
    const variants = product?.getVariants() ?? [];
    expect(product?.getHasVariants()).toBe(true);
    expect(variants.map((v): string => v.getId())).toEqual(['variant-1', 'variant-2']);
    expect(variants[0].getPriceOverride()?.getValue()).toBe(1500);
    expect(variants[0].getStatus()).toBe(ProductStatus.ACTIVE);
    expect(variants[1].getStatus()).toBe(ProductStatus.OUT_OF_STOCK);
    expect(product?.getVersion()).toBe(1);
    expect(repo.saveCount).toBe(1);
  });

  it('removes all variants when given an empty list', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct());
    await useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, variants: [variant()] });

    await useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, variants: [] });

    const product = await stored(repo);
    expect(product?.getVariants()).toHaveLength(0);
    expect(product?.getHasVariants()).toBe(false);
  });

  it('publishes nothing because the entity emits no event on variant change', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, variants: [variant()] });

    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it.each([
    { name: 'an invalid sku', input: { sku: 'x' }, error: InvalidSkuException },
    { name: 'negative stock', input: { stock: -1 }, error: InvalidProductAttributeException },
  ])(
    'propagates the domain exception for $name and saves nothing',
    async ({ input, error }): Promise<void> => {
      const { repo, useCase } = setup();
      repo.seed(buildProduct());

      await expect((): Promise<void> =>
        useCase.execute({ productId: PRODUCT_ID, tenantId: TENANT, variants: [variant(input)] }),
      ).rejects.toBeInstanceOf(error);
      expect((await stored(repo))?.getVariants()).toHaveLength(0);
      expect(repo.saveCount).toBe(0);
    },
  );

  it('throws ProductNotFoundException for an unknown id', async (): Promise<void> => {
    const { repo, useCase } = setup();

    await expect((): Promise<void> =>
      useCase.execute({ productId: 'missing', tenantId: TENANT, variants: [variant()] }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(repo.saveCount).toBe(0);
  });

  it("treats another tenant's product as not found and writes nothing", async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<void> =>
      useCase.execute({ productId: PRODUCT_ID, tenantId: OTHER_TENANT, variants: [variant()] }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect((await stored(repo))?.getVariants()).toHaveLength(0);
    expect(repo.saveCount).toBe(0);
  });
});
