import { describe, expect, it } from 'vitest';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { InMemoryCategoryRepository } from '@/testing/in-memory/in-memory-category.repository';
import { buildCategory } from '@/testing/builders/category.builder';
import type { Category } from '@/categories/domain/entities/category.entity';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';

import { CategoryName } from '@/categories/domain/value-objects/category-name.vo';
import { CategorySlug } from '@/categories/domain/value-objects/category-slug.vo';
import { InvalidCategoryStatusException } from '@/categories/domain/exceptions/invalid-category-status.exception';
import { SearchCategoryUseCase } from '@/categories/application/use-cases/search-category.use-case';

function seeded(): SearchCategoryUseCase {
  const repo = new InMemoryCategoryRepository();
  repo.seed(
    buildCategory(),
    buildCategory({
      id: createCategoryId('category-2'),
      name: CategoryName.from('Bakery'),
      slug: CategorySlug.create('bakery'),
      status: CategoryStatus.INACTIVE,
    }),
    buildCategory({
      id: createCategoryId('category-3'),
      name: CategoryName.from('Dry beverages'),
      slug: CategorySlug.create('dry-beverages'),
      status: CategoryStatus.ARCHIVED,
    }),
    buildCategory({
      id: createCategoryId('category-9'),
      tenantId: createTenantId(OTHER_TENANT),
    }),
  );
  return new SearchCategoryUseCase(repo);
}

function ids(items: Category[]): string[] {
  return items.map((category): string => category.getId());
}

describe('SearchCategoryUseCase', (): void => {
  it('returns every category of the tenant without filters', async (): Promise<void> => {
    const result = await seeded().execute({ tenantId: TENANT });
    expect(ids(result.items)).toEqual(['category-1', 'category-2', 'category-3']);
  });

  it('matches the name case-insensitively and never crosses tenants', async (): Promise<void> => {
    const result = await seeded().execute({ tenantId: TENANT, name: 'BEVER' });
    expect(ids(result.items)).toEqual(['category-1', 'category-3']);
  });

  it('filters by id', async (): Promise<void> => {
    const result = await seeded().execute({ tenantId: TENANT, id: 'category-2' });
    expect(ids(result.items)).toEqual(['category-2']);
  });

  it('does not return the category of another tenant by id', async (): Promise<void> => {
    const result = await seeded().execute({ tenantId: TENANT, id: 'category-9' });
    expect(result.items).toEqual([]);
  });

  it('filters by status and combines it with the name', async (): Promise<void> => {
    const useCase = seeded();
    expect(ids((await useCase.execute({ tenantId: TENANT, status: 'archived' })).items)).toEqual([
      'category-3',
    ]);
    expect(
      ids((await useCase.execute({ tenantId: TENANT, name: 'bever', status: 'active' })).items),
    ).toEqual(['category-1']);
  });

  it('rejects an unknown status string', async (): Promise<void> => {
    await expect((): Promise<unknown> =>
      seeded().execute({ tenantId: TENANT, status: 'bogus' }),
    ).rejects.toBeInstanceOf(InvalidCategoryStatusException);
  });

  it('paginates and reports totals', async (): Promise<void> => {
    const result = await seeded().execute({ tenantId: TENANT, pagination: { page: 1, limit: 2 } });
    expect(ids(result.items)).toEqual(['category-1', 'category-2']);
    expect(result.totalItems).toBe(3);
    expect(result.totalPages).toBe(2);
  });
});
