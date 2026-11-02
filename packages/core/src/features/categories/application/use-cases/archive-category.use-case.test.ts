import { describe, expect, it, vi } from 'vitest';
import { ArchiveCategoryUseCase } from '@/categories/application/use-cases/archive-category.use-case';
import { CategoryHasProductsException } from '@/categories/application/exceptions/category-has-products.exception';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';
import type { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import type { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';

interface Harness {
  useCase: ArchiveCategoryUseCase;
  archive: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}

function build(options: { found: boolean; productCount: number }): Harness {
  const archive = vi.fn();
  const save = vi.fn().mockResolvedValue(undefined);
  const category = {
    archive,
    domainEvents: [],
    clearDomainEvents: vi.fn(),
    getId: (): string => CATEGORY_ID,
  };
  const repository = {
    findById: vi.fn().mockResolvedValue(options.found ? category : null),
    countProductsInCategory: vi.fn().mockResolvedValue(options.productCount),
    save,
  } as unknown as CategoryRepositoryPort;
  const transactions = {
    runInTransaction: async <T>(work: (tx: never) => Promise<T>): Promise<T> => work({} as never),
  } as unknown as TransactionManagerPort;
  const eventBus = { publish: vi.fn() } as unknown as EventBusPort;
  return { useCase: new ArchiveCategoryUseCase(repository, eventBus, transactions), archive, save };
}

describe('ArchiveCategoryUseCase', (): void => {
  it('archives a category that has no active products', async (): Promise<void> => {
    const { useCase, archive, save } = build({ found: true, productCount: 0 });
    await expect(useCase.execute({ id: CATEGORY_ID, tenantId: TENANT_ID })).resolves.toBe(
      CATEGORY_ID,
    );
    expect(archive).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
  });

  it('refuses to archive a category that still has products and changes nothing', async (): Promise<void> => {
    const { useCase, archive, save } = build({ found: true, productCount: 3 });
    await expect(useCase.execute({ id: CATEGORY_ID, tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      CategoryHasProductsException,
    );
    expect(archive).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('reports a missing category before counting products', async (): Promise<void> => {
    const { useCase } = build({ found: false, productCount: 0 });
    await expect(useCase.execute({ id: CATEGORY_ID, tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      CategoryNotFoundException,
    );
  });
});
