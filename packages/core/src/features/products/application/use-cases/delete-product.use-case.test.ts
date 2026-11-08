import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryProductRepository } from '@/testing/in-memory/in-memory-product.repository';
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

import { DeleteProductUseCase } from '@/products/application/use-cases/delete-product.use-case';

describe('DeleteProductUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });
  it('deletes the tenant product and returns its id', async (): Promise<void> => {
    const repo = new InMemoryProductRepository();
    repo.seed(buildProduct());

    const id = await new DeleteProductUseCase(repo).execute({ id: PRODUCT_ID, tenantId: TENANT });

    expect(id).toBe(PRODUCT_ID);
    expect(repo.deleteCount).toBe(1);
    expect(await stored(repo)).toBeNull();
  });

  it('throws ProductNotFoundException for an unknown id and deletes nothing', async (): Promise<void> => {
    const repo = new InMemoryProductRepository();

    await expect((): Promise<string> =>
      new DeleteProductUseCase(repo).execute({ id: 'missing', tenantId: TENANT }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(repo.deleteCount).toBe(0);
  });

  it("treats another tenant's product as not found and keeps it", async (): Promise<void> => {
    const repo = new InMemoryProductRepository();
    repo.seed(buildProduct());

    await expect((): Promise<string> =>
      new DeleteProductUseCase(repo).execute({ id: PRODUCT_ID, tenantId: OTHER_TENANT }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(repo.deleteCount).toBe(0);
    expect(await stored(repo)).not.toBeNull();
  });
});
