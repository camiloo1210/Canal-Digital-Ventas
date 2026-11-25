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

import { ArchiveProductUseCase } from '@/products/application/use-cases/archive-product.use-case';
import { FakeTransactionManager } from '@/testing/fakes/fake-transaction-manager';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import { InvalidProductStateException } from '@/products/domain/exceptions/invalid-product-state.exception';
import { ProductArchivedEvent } from '@/products/domain/events/product-archived.event';

interface Harness {
  repo: InMemoryProductRepository;
  bus: FakeEventBus;
  tx: FakeTransactionManager;
  useCase: ArchiveProductUseCase;
}

function setup(): Harness {
  const repo = new InMemoryProductRepository();
  const bus = new FakeEventBus();
  const tx = new FakeTransactionManager();
  return { repo, bus, tx, useCase: new ArchiveProductUseCase(repo, bus, tx) };
}

describe('ArchiveProductUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('archives the product, publishes its event with context and commits', async (): Promise<void> => {
    const { repo, bus, tx, useCase } = setup();
    repo.seed(buildProduct());

    const id = await useCase.execute({ id: PRODUCT_ID, tenantId: TENANT });

    expect(id).toBe(PRODUCT_ID);
    const stored = await repo.findById(createProductId(PRODUCT_ID), createTenantId(TENANT));
    expect(stored?.getStatus()).toBe(ProductStatus.ARCHIVED);
    expect(repo.saveCount).toBe(1);
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0].event).toBeInstanceOf(ProductArchivedEvent);
    expect(bus.published[0].context).toEqual({
      tenantId: TENANT,
      aggregateType: 'Product',
      aggregateId: PRODUCT_ID,
    });
    expect(tx.committed).toBe(1);
    expect(tx.rolledBack).toBe(0);
    expect(tx.calls).toEqual([{ userId: TENANT }]);
  });

  it('throws ProductNotFoundException for an unknown id and rolls back', async (): Promise<void> => {
    const { bus, tx, useCase, repo } = setup();

    await expect((): Promise<string> =>
      useCase.execute({ id: 'missing', tenantId: TENANT }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(bus.published).toHaveLength(0);
    expect(repo.saveCount).toBe(0);
    expect(tx.rolledBack).toBe(1);
    expect(tx.committed).toBe(0);
  });

  it("treats another tenant's product as not found and writes nothing", async (): Promise<void> => {
    const { repo, bus, tx, useCase } = setup();
    repo.seed(buildProduct());

    await expect((): Promise<string> =>
      useCase.execute({ id: PRODUCT_ID, tenantId: OTHER_TENANT }),
    ).rejects.toBeInstanceOf(ProductNotFoundException);

    const untouched = await repo.findById(createProductId(PRODUCT_ID), createTenantId(TENANT));
    expect(untouched?.getStatus()).toBe(ProductStatus.ACTIVE);
    expect(repo.saveCount).toBe(0);
    expect(bus.published).toHaveLength(0);
    expect(tx.rolledBack).toBe(1);
  });

  it('rejects a stale expectedVersion with OptimisticConcurrencyException and saves nothing', async (): Promise<void> => {
    const { repo, bus, tx, useCase } = setup();
    repo.seed(buildProduct({ version: 3 }));

    await expect((): Promise<string> =>
      useCase.execute({ id: PRODUCT_ID, tenantId: TENANT, expectedVersion: 2 }),
    ).rejects.toThrow(new OptimisticConcurrencyException('Product', PRODUCT_ID));
    expect(repo.saveCount).toBe(0);
    expect(bus.published).toHaveLength(0);
    expect(tx.rolledBack).toBe(1);
  });

  it('accepts a matching expectedVersion', async (): Promise<void> => {
    const { repo, tx, useCase } = setup();
    repo.seed(buildProduct({ version: 3 }));

    await useCase.execute({ id: PRODUCT_ID, tenantId: TENANT, expectedVersion: 3 });

    const stored = await repo.findById(createProductId(PRODUCT_ID), createTenantId(TENANT));
    expect(stored?.getVersion()).toBe(4);
    expect(tx.committed).toBe(1);
  });

  it('propagates the domain exception for an already archived product and rolls back', async (): Promise<void> => {
    const { repo, bus, tx, useCase } = setup();
    repo.seed(buildProduct({ status: ProductStatus.ARCHIVED }));

    await expect((): Promise<string> =>
      useCase.execute({ id: PRODUCT_ID, tenantId: TENANT }),
    ).rejects.toBeInstanceOf(InvalidProductStateException);
    expect(repo.saveCount).toBe(0);
    expect(bus.published).toHaveLength(0);
    expect(tx.rolledBack).toBe(1);
    expect(tx.committed).toBe(0);
  });
});
