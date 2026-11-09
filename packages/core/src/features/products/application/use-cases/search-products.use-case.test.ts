import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryProductRepository } from '@/testing/in-memory/in-memory-product.repository';
import { buildProduct } from '@/testing/builders/product.builder';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import type { Product } from '@/products/domain/entities/product.entity';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const NOW = new Date('2026-01-15T12:00:00.000Z');

import { SearchProductsUseCase } from '@/products/application/use-cases/search-products.use-case';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { createCategoryId } from '@/products/domain/types/category-id.type';

function seeded(): InMemoryProductRepository {
  const repo = new InMemoryProductRepository();
  repo.seed(
    buildProduct({
      id: createProductId('p1'),
      name: ProductName.from('Red shirt'),
      sku: Sku.from('SHIRT-001'),
    }),
    buildProduct({
      id: createProductId('p2'),
      name: ProductName.from('Blue pants'),
      sku: Sku.from('PANTS-001'),
      categoryId: createCategoryId('category-2'),
      status: ProductStatus.INACTIVE,
    }),
    buildProduct({
      id: createProductId('foreign'),
      name: ProductName.from('Red shirt'),
      tenantId: createTenantId(OTHER_TENANT),
    }),
  );
  return repo;
}

async function ids(promise: Promise<{ items: Product[] }>): Promise<string[]> {
  return (await promise).items.map((p): string => p.getId());
}

describe('SearchProductsUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });
  it('never returns products of another tenant', async (): Promise<void> => {
    const useCase = new SearchProductsUseCase(seeded());

    expect(await ids(useCase.execute({ tenantId: TENANT }))).toEqual(['p1', 'p2']);
    expect(await ids(useCase.execute({ tenantId: TENANT, name: 'red' }))).toEqual(['p1']);
  });

  it.each([
    { name: 'name', dto: { name: 'PANTS' }, expected: ['p2'] },
    { name: 'category', dto: { categoryId: 'category-2' }, expected: ['p2'] },
    { name: 'sku', dto: { sku: 'SHIRT-001' }, expected: ['p1'] },
    { name: 'status', dto: { status: 'inactive' }, expected: ['p2'] },
    { name: 'id', dto: { id: 'p1' }, expected: ['p1'] },
    { name: 'no match', dto: { name: 'zzz' }, expected: [] },
  ])('filters by $name', async ({ dto, expected }): Promise<void> => {
    const useCase = new SearchProductsUseCase(seeded());

    expect(await ids(useCase.execute({ tenantId: TENANT, ...dto }))).toEqual(expected);
  });

  it('passes pagination through to the repository', async (): Promise<void> => {
    const useCase = new SearchProductsUseCase(seeded());

    const result = await useCase.execute({ tenantId: TENANT, pagination: { page: 2, limit: 1 } });

    expect(result.items.map((p): string => p.getId())).toEqual(['p2']);
    expect(result.totalItems).toBe(2);
    expect(result.totalPages).toBe(2);
  });

  it('rejects an unknown status with InvalidProductAttributeException', async (): Promise<void> => {
    const useCase = new SearchProductsUseCase(seeded());

    await expect((): Promise<unknown> =>
      useCase.execute({ tenantId: TENANT, status: 'bogus' }),
    ).rejects.toBeInstanceOf(InvalidProductAttributeException);
  });
});
