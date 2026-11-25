import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryProductRepository } from '@/testing/in-memory/in-memory-product.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildProduct } from '@/testing/builders/product.builder';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const PRODUCT_ID = 'product-1';
const NOW = new Date('2026-01-15T12:00:00.000Z');

import { UnarchiveProductUseCase } from '@/products/application/use-cases/unarchive-product.use-case';
import { FakeTransactionManager } from '@/testing/fakes/fake-transaction-manager';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import { InvalidProductStateException } from '@/products/domain/exceptions/invalid-product-state.exception';

interface Harness {
  repo: InMemoryProductRepository;
  bus: FakeEventBus;
  tx: FakeTransactionManager;
  useCase: UnarchiveProductUseCase;
}

function setup(): Harness {
  const repo = new InMemoryProductRepository();
  const bus = new FakeEventBus();
  const tx = new FakeTransactionManager();
  return { repo, bus, tx, useCase: new UnarchiveProductUseCase(repo, bus, tx) };
}

describe('UnarchiveProductUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it.each([
    { stock: 5, expected: ProductStatus.ACTIVE },
    { stock: 0, expected: ProductStatus.OUT_OF_STOCK },
  ])(
    'restores an archived product with stock $stock to $expected and commits',
    async ({ stock, expected }): Promise<void> => {
      const { repo, tx, useCase } = setup();
      repo.seed(buildProduct({ status: ProductStatus.ARCHIVED, stock }));

      const id = await useCase.execute({ id: PRODUCT_ID, tenantId: TENANT });

      expect(id).toBe(PRODUCT_ID);
      const stored = await repo.findById(createProductId(PRODUCT_ID), createTenantId(TENANT));
      expect(stored?.getStatus()).toBe(expected);
      expect(stored?.getVersion()).toBe(1);
      expect(repo.saveCount).toBe(1);
      expect(tx.committed).toBe(1);
      expect(tx.calls).toEqual([{ userId: TENANT }]);
    },
  );

  it('publishes ProductDetailsChangedEvent so Kivi sees it available again', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildProduct({ status: ProductStatus.ARCHIVED }));

    await useCase.execute({ id: PRODUCT_ID, tenantId: TENANT });

    expect(bus.published.map((envelope): string => envelope.event.eventName)).toEqual([
      'ProductDetailsChangedEvent',
    ]);
  });

  it('throws ProductNotFoundException for an unknown id and rolls back', async (): Promise<void> => {
    const { repo, bus, tx, useCase } = setup();

    await expect((): Promise<string> =>
      useCase.execute({ id: 'missing', tenantId: TENANT }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(repo.saveCount).toBe(0);
    expect(bus.published).toHaveLength(0);
    expect(tx.rolledBack).toBe(1);
  });

  it("treats another tenant's product as not found and writes nothing", async (): Promise<void> => {
    const { repo, tx, useCase } = setup();
    repo.seed(buildProduct({ status: ProductStatus.ARCHIVED }));

    await expect((): Promise<string> =>
      useCase.execute({ id: PRODUCT_ID, tenantId: OTHER_TENANT }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);

    const untouched = await repo.findById(createProductId(PRODUCT_ID), createTenantId(TENANT));
    expect(untouched?.getStatus()).toBe(ProductStatus.ARCHIVED);
    expect(repo.saveCount).toBe(0);
    expect(tx.rolledBack).toBe(1);
  });

  it('rejects a stale expectedVersion with OptimisticConcurrencyException and saves nothing', async (): Promise<void> => {
    const { repo, tx, useCase } = setup();
    repo.seed(buildProduct({ status: ProductStatus.ARCHIVED, version: 3 }));

    await expect((): Promise<string> =>
      useCase.execute({ id: PRODUCT_ID, tenantId: TENANT, expectedVersion: 1 }),
    ).rejects.toThrow(new OptimisticConcurrencyException('Product', PRODUCT_ID));
    expect(repo.saveCount).toBe(0);
    expect(tx.rolledBack).toBe(1);
  });

  it('propagates the domain exception for a non-archived product and rolls back', async (): Promise<void> => {
    const { repo, tx, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<string> =>
      useCase.execute({ id: PRODUCT_ID, tenantId: TENANT }),
    ).rejects.toBeInstanceOf(InvalidProductStateException);
    expect(repo.saveCount).toBe(0);
    expect(tx.rolledBack).toBe(1);
    expect(tx.committed).toBe(0);
  });
});
