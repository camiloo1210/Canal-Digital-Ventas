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

import { UnarchiveCategoryUseCase } from '@/categories/application/use-cases/unarchive-category.use-case';
import { InvalidCategoryStatusException } from '@/categories/domain/exceptions/invalid-category-status.exception';

interface Harness {
  repo: InMemoryCategoryRepository;
  bus: FakeEventBus;
  tx: FakeTransactionManager;
  useCase: UnarchiveCategoryUseCase;
}

function setup(): Harness {
  const repo = new InMemoryCategoryRepository();
  const bus = new FakeEventBus();
  const tx = new FakeTransactionManager();
  return { repo, bus, tx, useCase: new UnarchiveCategoryUseCase(repo, bus, tx) };
}

describe('UnarchiveCategoryUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('reactivates an archived category, bumps the version and commits', async (): Promise<void> => {
    const { repo, tx, useCase } = setup();
    repo.seed(buildCategory({ status: CategoryStatus.ARCHIVED }));

    const id = await useCase.execute({ id: CATEGORY_ID, tenantId: TENANT });

    expect(id).toBe(CATEGORY_ID);
    const category = await stored(repo);
    expect(category?.getStatus()).toBe(CategoryStatus.ACTIVE);
    expect(category?.getVersion()).toBe(2);
    expect(repo.saveCount).toBe(1);
    expect(tx.committed).toBe(1);
    expect(tx.rolledBack).toBe(0);
    expect(tx.calls).toEqual([{ userId: TENANT }]);
  });

  // FINDING: Category.unarchive() emits no domain event, so unarchiving publishes nothing and
  // downstream consumers (outbox relay, projections) never learn the category is active again,
  // unlike archive() which emits CategoryArchivedEvent. Expected: one event with the category
  // aggregate context.
  it.fails(
    'publishes an event for the unarchive with the category context',
    async (): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildCategory({ status: CategoryStatus.ARCHIVED }));

      await useCase.execute({ id: CATEGORY_ID, tenantId: TENANT });

      expect(bus.published).toHaveLength(1);
      expect(bus.published[0].context).toEqual({
        tenantId: TENANT,
        aggregateType: 'Category',
        aggregateId: CATEGORY_ID,
      });
    },
  );

  it('throws CategoryNotFoundException for an unknown id and rolls back', async (): Promise<void> => {
    const { repo, bus, tx, useCase } = setup();
    await expect((): Promise<string> =>
      useCase.execute({ id: CATEGORY_ID, tenantId: TENANT }),
    ).rejects.toBeInstanceOf(CategoryNotFoundException);
    expect(tx.committed).toBe(0);
    expect(tx.rolledBack).toBe(1);
    expect(repo.saveCount).toBe(0);
    expect(bus.published).toHaveLength(0);
  });

  it('does not touch an archived category of another tenant', async (): Promise<void> => {
    const { repo, tx, useCase } = setup();
    repo.seed(
      buildCategory({ tenantId: createTenantId(OTHER_TENANT), status: CategoryStatus.ARCHIVED }),
    );

    await expect((): Promise<string> =>
      useCase.execute({ id: CATEGORY_ID, tenantId: TENANT }),
    ).rejects.toBeInstanceOf(CategoryNotFoundException);

    expect((await stored(repo, OTHER_TENANT))?.getStatus()).toBe(CategoryStatus.ARCHIVED);
    expect(tx.rolledBack).toBe(1);
    expect(repo.saveCount).toBe(0);
  });

  it.each([CategoryStatus.ACTIVE, CategoryStatus.INACTIVE])(
    'refuses a %s category and rolls back without saving',
    async (status): Promise<void> => {
      const { repo, bus, tx, useCase } = setup();
      repo.seed(buildCategory({ status }));

      await expect((): Promise<string> =>
        useCase.execute({ id: CATEGORY_ID, tenantId: TENANT }),
      ).rejects.toBeInstanceOf(InvalidCategoryStatusException);

      expect((await stored(repo))?.getStatus()).toBe(status);
      expect(tx.committed).toBe(0);
      expect(tx.rolledBack).toBe(1);
      expect(repo.saveCount).toBe(0);
      expect(bus.published).toHaveLength(0);
    },
  );
});
