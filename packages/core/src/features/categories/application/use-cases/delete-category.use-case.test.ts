import { describe, expect, it } from 'vitest';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { InMemoryCategoryRepository } from '@/testing/in-memory/in-memory-category.repository';
import { buildCategory } from '@/testing/builders/category.builder';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';
import type { Category } from '@/categories/domain/entities/category.entity';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const CATEGORY_ID = 'category-1';

async function stored(
  repo: InMemoryCategoryRepository,
  tenant: string = TENANT,
): Promise<Category | null> {
  return repo.findById(createCategoryId(CATEGORY_ID), createTenantId(tenant));
}

import { DeleteCategoryUseCase } from '@/categories/application/use-cases/delete-category.use-case';

function setup(): { repo: InMemoryCategoryRepository; useCase: DeleteCategoryUseCase } {
  const repo = new InMemoryCategoryRepository();
  return { repo, useCase: new DeleteCategoryUseCase(repo) };
}

describe('DeleteCategoryUseCase', (): void => {
  it('deletes the category of the tenant and keeps the others', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(
      buildCategory(),
      buildCategory({ id: createCategoryId('category-2') }),
      buildCategory({ tenantId: createTenantId(OTHER_TENANT) }),
    );

    await useCase.execute({ id: CATEGORY_ID, tenantId: TENANT });

    expect(await stored(repo)).toBeNull();
    expect(
      await repo.findById(createCategoryId('category-2'), createTenantId(TENANT)),
    ).not.toBeNull();
    expect(await stored(repo, OTHER_TENANT)).not.toBeNull();
    expect(repo.deleteCount).toBe(1);
  });

  it('throws CategoryNotFoundException for an unknown id and deletes nothing', async (): Promise<void> => {
    const { repo, useCase } = setup();
    await expect((): Promise<void> =>
      useCase.execute({ id: CATEGORY_ID, tenantId: TENANT }),
    ).rejects.toBeInstanceOf(CategoryNotFoundException);
    expect(repo.deleteCount).toBe(0);
  });

  it('cannot delete a category of another tenant', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCategory({ tenantId: createTenantId(OTHER_TENANT) }));

    await expect((): Promise<void> =>
      useCase.execute({ id: CATEGORY_ID, tenantId: TENANT }),
    ).rejects.toBeInstanceOf(CategoryNotFoundException);

    expect(await stored(repo, OTHER_TENANT)).not.toBeNull();
    expect(repo.deleteCount).toBe(0);
  });

  // FINDING: DeleteCategoryUseCase deletes without checking for products, unlike
  // ArchiveCategoryUseCase which throws CategoryHasProductsException. Hard-deleting a category
  // that still has products orphans them. Expected: rejection and the category kept.
  it.fails('refuses to delete a category that still has products', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCategory());
    repo.setProductCount(CATEGORY_ID, TENANT, 3);

    await expect((): Promise<void> =>
      useCase.execute({ id: CATEGORY_ID, tenantId: TENANT }),
    ).rejects.toBeInstanceOf(Error);

    expect(await stored(repo)).not.toBeNull();
    expect(repo.deleteCount).toBe(0);
  });
});
