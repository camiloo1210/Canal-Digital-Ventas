import { describe, expect, it } from 'vitest';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { InMemoryCategoryRepository } from '@/testing/in-memory/in-memory-category.repository';
import { buildCategory } from '@/testing/builders/category.builder';
import type { Category } from '@/categories/domain/entities/category.entity';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';

import { ListCategoriesUseCase } from '@/categories/application/use-cases/list-categories.use-case';

function seeded(): { repo: InMemoryCategoryRepository; useCase: ListCategoriesUseCase } {
  const repo = new InMemoryCategoryRepository();
  repo.seed(
    buildCategory(),
    buildCategory({ id: createCategoryId('category-2') }),
    buildCategory({ id: createCategoryId('category-3') }),
    buildCategory({ id: createCategoryId('category-9'), tenantId: createTenantId(OTHER_TENANT) }),
  );
  return { repo, useCase: new ListCategoriesUseCase(repo) };
}

function ids(items: Category[]): string[] {
  return items.map((category): string => category.getId());
}

describe('ListCategoriesUseCase', (): void => {
  it('lists only the categories of the tenant', async (): Promise<void> => {
    const { useCase } = seeded();
    const result = await useCase.execute({ tenantId: TENANT });
    expect(ids(result.items)).toEqual(['category-1', 'category-2', 'category-3']);
    expect(result.totalItems).toBe(3);
  });

  it('returns an empty page for a tenant without categories', async (): Promise<void> => {
    const { useCase } = seeded();
    const result = await useCase.execute({ tenantId: 'tenant-empty' });
    expect(result.items).toEqual([]);
    expect(result.totalItems).toBe(0);
  });

  it('paginates and reports totals', async (): Promise<void> => {
    const { useCase } = seeded();
    const result = await useCase.execute({ tenantId: TENANT, pagination: { page: 2, limit: 2 } });
    expect(ids(result.items)).toEqual(['category-3']);
    expect(result.totalItems).toBe(3);
    expect(result.totalPages).toBe(2);
    expect(result.currentPage).toBe(2);
  });

  it('does not write anything', async (): Promise<void> => {
    const { repo, useCase } = seeded();
    await useCase.execute({ tenantId: TENANT });
    expect(repo.saveCount).toBe(0);
    expect(repo.deleteCount).toBe(0);
  });
});
