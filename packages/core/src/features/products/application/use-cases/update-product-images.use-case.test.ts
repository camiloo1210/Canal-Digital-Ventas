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

import { UpdateProductImagesUseCase } from '@/products/application/use-cases/update-product-images.use-case';

function setup(): {
  repo: InMemoryProductRepository;
  bus: FakeEventBus;
  useCase: UpdateProductImagesUseCase;
} {
  const repo = new InMemoryProductRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new UpdateProductImagesUseCase(repo, bus) };
}

describe('UpdateProductImagesUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });
  it('stores the image path and url and bumps the version', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute({
      productId: PRODUCT_ID,
      tenantId: TENANT,
      imagePath: 'tenant-1/a.jpg',
      imageUrl: 'https://cdn.test/a.jpg',
    });

    const product = await stored(repo);
    expect(product?.getImagePath()).toBe('tenant-1/a.jpg');
    expect(product?.getImageUrl()).toBe('https://cdn.test/a.jpg');
    expect(product?.getVersion()).toBe(1);
    expect(product?.getUpdatedAt()).toEqual(NOW);
    expect(repo.saveCount).toBe(1);
  });

  it('clears the images when both values are null', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct({ imagePath: 'x.jpg', imageUrl: 'https://cdn.test/x.jpg' }));

    await useCase.execute({
      productId: PRODUCT_ID,
      tenantId: TENANT,
      imagePath: null,
      imageUrl: null,
    });

    const product = await stored(repo);
    expect(product?.getImagePath()).toBeNull();
    expect(product?.getImageUrl()).toBeNull();
  });

  it('publishes nothing because the entity emits no event on image change', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct());

    await useCase.execute({
      productId: PRODUCT_ID,
      tenantId: TENANT,
      imagePath: 'a',
      imageUrl: 'b',
    });

    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('throws ProductNotFoundException for an unknown id', async (): Promise<void> => {
    const { repo, useCase } = setup();

    await expect((): Promise<void> =>
      useCase.execute({ productId: 'missing', tenantId: TENANT, imagePath: null, imageUrl: null }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(repo.saveCount).toBe(0);
  });

  it("treats another tenant's product as not found and writes nothing", async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<void> =>
      useCase.execute({
        productId: PRODUCT_ID,
        tenantId: OTHER_TENANT,
        imagePath: 'evil',
        imageUrl: 'evil',
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect((await stored(repo))?.getImagePath()).toBeNull();
    expect(repo.saveCount).toBe(0);
  });
});
