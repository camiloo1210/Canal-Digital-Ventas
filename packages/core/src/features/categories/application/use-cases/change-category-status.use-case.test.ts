import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { FakeTransactionManager } from '@/testing/fakes/fake-transaction-manager';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
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

const NOW = new Date('2026-01-15T12:00:00.000Z');

import { ChangeCategoryStatusUseCase } from '@/categories/application/use-cases/change-category-status.use-case';
import { InvalidCategoryStatusException } from '@/categories/domain/exceptions/invalid-category-status.exception';

interface Harness {
  repo: InMemoryCategoryRepository;
  bus: FakeEventBus;
  tx: FakeTransactionManager;
  useCase: ChangeCategoryStatusUseCase;
}

function setup(): Harness {
  const repo = new InMemoryCategoryRepository();
  const bus = new FakeEventBus();
  const tx = new FakeTransactionManager();
  return { repo, bus, tx, useCase: new ChangeCategoryStatusUseCase(repo, bus, tx) };
}

describe('ChangeCategoryStatusUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it.each([
    [CategoryStatus.ACTIVE, CategoryStatus.INACTIVE],
    [CategoryStatus.INACTIVE, CategoryStatus.ACTIVE],
    [CategoryStatus.ACTIVE, CategoryStatus.ARCHIVED],
  ])(
    'moves %s to %s, publishes the event with context and commits',
    async (from, to): Promise<void> => {
      const { repo, bus, tx, useCase } = setup();
      repo.seed(buildCategory({ status: from }));

      await useCase.execute({ id: CATEGORY_ID, tenantId: TENANT, status: to });

      const category = await stored(repo);
      expect(category?.getStatus()).toBe(to);
      expect(category?.getVersion()).toBe(2);
      expect(repo.saveCount).toBe(1);
      expect(bus.published).toHaveLength(1);
      expect(bus.published[0].event).toMatchObject({
        eventName: 'CategoryStatusUpdatedEvent',
        categoryId: CATEGORY_ID,
        newStatus: to,
      });
      expect(bus.published[0].context).toEqual({
        tenantId: TENANT,
        aggregateType: 'Category',
        aggregateId: CATEGORY_ID,
      });
      expect(tx.committed).toBe(1);
      expect(tx.rolledBack).toBe(0);
      expect(tx.calls).toEqual([{ userId: TENANT }]);
    },
  );

  it('throws CategoryNotFoundException for an unknown id and rolls back', async (): Promise<void> => {
    const { repo, bus, tx, useCase } = setup();
    await expect((): Promise<void> =>
      useCase.execute({ id: CATEGORY_ID, tenantId: TENANT, status: 'inactive' }),
    ).rejects.toBeInstanceOf(CategoryNotFoundException);
    expect(tx.committed).toBe(0);
    expect(tx.rolledBack).toBe(1);
    expect(repo.saveCount).toBe(0);
    expect(bus.published).toHaveLength(0);
  });

  it('does not touch a category of another tenant', async (): Promise<void> => {
    const { repo, bus, tx, useCase } = setup();
    repo.seed(buildCategory({ tenantId: createTenantId(OTHER_TENANT) }));

    await expect((): Promise<void> =>
      useCase.execute({ id: CATEGORY_ID, tenantId: TENANT, status: 'inactive' }),
    ).rejects.toBeInstanceOf(CategoryNotFoundException);

    expect((await stored(repo, OTHER_TENANT))?.getStatus()).toBe(CategoryStatus.ACTIVE);
    expect(tx.rolledBack).toBe(1);
    expect(repo.saveCount).toBe(0);
    expect(bus.published).toHaveLength(0);
  });

  it('refuses to change an archived category and rolls back without saving', async (): Promise<void> => {
    const { repo, bus, tx, useCase } = setup();
    repo.seed(buildCategory({ status: CategoryStatus.ARCHIVED }));

    await expect((): Promise<void> =>
      useCase.execute({ id: CATEGORY_ID, tenantId: TENANT, status: 'active' }),
    ).rejects.toBeInstanceOf(InvalidCategoryStatusException);

    expect((await stored(repo))?.getStatus()).toBe(CategoryStatus.ARCHIVED);
    expect(tx.committed).toBe(0);
    expect(tx.rolledBack).toBe(1);
    expect(repo.saveCount).toBe(0);
    expect(bus.published).toHaveLength(0);
  });

  it('rejects an unknown status string and rolls back without saving', async (): Promise<void> => {
    const { repo, bus, tx, useCase } = setup();
    repo.seed(buildCategory());

    await expect((): Promise<void> =>
      useCase.execute({ id: CATEGORY_ID, tenantId: TENANT, status: 'bogus' }),
    ).rejects.toBeInstanceOf(InvalidCategoryStatusException);

    expect((await stored(repo))?.getStatus()).toBe(CategoryStatus.ACTIVE);
    expect(tx.rolledBack).toBe(1);
    expect(repo.saveCount).toBe(0);
    expect(bus.published).toHaveLength(0);
  });
});
