import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryProductRepository } from '@/testing/in-memory/in-memory-product.repository';
import { buildProduct } from '@/testing/builders/product.builder';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const NOW = new Date('2026-01-15T12:00:00.000Z');

import { ListProductsUseCase } from '@/products/application/use-cases/list-products.use-case';

describe('ListProductsUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });
  it('returns only the tenant products', async (): Promise<void> => {
    const repo = new InMemoryProductRepository();
    repo.seed(
      buildProduct(),
      buildProduct({ id: createProductId('product-2') }),
      buildProduct({ id: createProductId('foreign'), tenantId: createTenantId(OTHER_TENANT) }),
    );

    const result = await new ListProductsUseCase(repo).execute({ tenantId: TENANT });

    expect(result.items.map((p): string => p.getId())).toEqual(['product-1', 'product-2']);
    expect(result.totalItems).toBe(2);
  });

  it('returns an empty page for a tenant without products', async (): Promise<void> => {
    const repo = new InMemoryProductRepository();
    repo.seed(buildProduct());

    const result = await new ListProductsUseCase(repo).execute({ tenantId: OTHER_TENANT });

    expect(result.items).toHaveLength(0);
    expect(result.totalItems).toBe(0);
  });

  it('passes pagination through to the repository', async (): Promise<void> => {
    const repo = new InMemoryProductRepository();
    repo.seed(
      buildProduct({ id: createProductId('p1') }),
      buildProduct({ id: createProductId('p2') }),
      buildProduct({ id: createProductId('p3') }),
    );

    const result = await new ListProductsUseCase(repo).execute({
      tenantId: TENANT,
      pagination: { page: 2, limit: 2 },
    });

    expect(result.items.map((p): string => p.getId())).toEqual(['p3']);
    expect(result.currentPage).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.totalItems).toBe(3);
  });
});
