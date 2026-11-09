import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeTransactionManager } from '@/testing/fakes/fake-transaction-manager';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { InMemoryProductRepository } from '@/testing/in-memory/in-memory-product.repository';
import { buildProduct } from '@/testing/builders/product.builder';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { ProductArchivedEvent } from '@/products/domain/events/product-archived.event';

const TENANT_A = createTenantId('tenant-a');
const TENANT_B = createTenantId('tenant-b');
const P1 = createProductId('product-1');

describe('testing kit', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  describe('buildProduct', (): void => {
    it('builds a valid active product with deterministic defaults', (): void => {
      const product = buildProduct();
      expect(product.getId()).toBe('product-1');
      expect(product.getStock()).toBe(10);
      expect(product.getStatus()).toBe(ProductStatus.ACTIVE);
      expect(product.getPrice().getValue()).toBe(10);
      expect(product.domainEvents).toHaveLength(0);
    });

    it('applies overrides', (): void => {
      expect(buildProduct({ stock: 3 }).getStock()).toBe(3);
    });
  });

  describe('InMemoryProductRepository', (): void => {
    it('returns null when the product belongs to another tenant', async (): Promise<void> => {
      const repo = new InMemoryProductRepository();
      repo.seed(buildProduct({ tenantId: TENANT_A }));
      expect(await repo.findById(P1, TENANT_B)).toBeNull();
      expect(await repo.findById(P1, TENANT_A)).not.toBeNull();
    });

    it('scopes list, search and category reads to the tenant', async (): Promise<void> => {
      const repo = new InMemoryProductRepository();
      repo.seed(
        buildProduct({ tenantId: TENANT_A }),
        buildProduct({ tenantId: TENANT_B, id: createProductId('product-2') }),
      );
      expect((await repo.findAll(TENANT_A)).items).toHaveLength(1);
      expect((await repo.searchByFilters({ tenantId: TENANT_B })).items).toHaveLength(1);
      expect(await repo.searchProductsByName('test', TENANT_A)).toHaveLength(1);
      expect(await repo.findByCategoryId(buildProduct().getCategory(), TENANT_B)).toHaveLength(1);
    });

    it('paginates findAll', async (): Promise<void> => {
      const repo = new InMemoryProductRepository();
      repo.seed(
        buildProduct({ id: createProductId('p1') }),
        buildProduct({ id: createProductId('p2') }),
        buildProduct({ id: createProductId('p3') }),
      );
      const page = await repo.findAll(buildProduct().getTenantId(), { page: 2, limit: 2 });
      expect(page.items.map((p): string => p.getId())).toEqual(['p3']);
      expect(page.totalItems).toBe(3);
      expect(page.totalPages).toBe(2);
      expect(page.currentPage).toBe(2);
    });

    it('stores a snapshot on save, not the live instance', async (): Promise<void> => {
      const repo = new InMemoryProductRepository();
      const product = buildProduct();
      await repo.save(product);
      product.adjustStock(99);

      const stored = await repo.findById(P1, product.getTenantId());
      expect(stored?.getStock()).toBe(10);
      expect(repo.saveCount).toBe(1);
    });

    it('returns independent instances without domain events', async (): Promise<void> => {
      const repo = new InMemoryProductRepository();
      const product = buildProduct();
      product.archive();
      await repo.save(product);
      const first = await repo.findById(P1, product.getTenantId());
      first?.adjustStock(1);
      const second = await repo.findById(P1, product.getTenantId());
      expect(second?.getStatus()).toBe(ProductStatus.ARCHIVED);
      expect(second?.domainEvents).toHaveLength(0);
    });

    it('deletes only within the tenant', async (): Promise<void> => {
      const repo = new InMemoryProductRepository();
      repo.seed(buildProduct({ tenantId: TENANT_A }));
      await repo.delete(P1, TENANT_B);
      expect(await repo.findById(P1, TENANT_A)).not.toBeNull();
      await repo.delete(P1, TENANT_A);
      expect(await repo.findById(P1, TENANT_A)).toBeNull();
    });
  });

  describe('FakeTransactionManager', (): void => {
    it('counts a commit when the operation resolves', async (): Promise<void> => {
      const manager = new FakeTransactionManager();
      const result = await manager.runInTransaction(async (): Promise<string> => 'ok', {
        userId: 'u1',
      });
      expect(result).toBe('ok');
      expect(manager.committed).toBe(1);
      expect(manager.rolledBack).toBe(0);
      expect(manager.calls).toEqual([{ userId: 'u1' }]);
    });

    it('counts a rollback and rethrows when the operation fails', async (): Promise<void> => {
      const manager = new FakeTransactionManager();
      const failure = new RangeError('boom');
      await expect(
        manager.runInTransaction(
          async (): Promise<void> => {
            throw failure;
          },
          { userId: 'u1', tenantId: 't1' },
        ),
      ).rejects.toBe(failure);
      expect(manager.committed).toBe(0);
      expect(manager.rolledBack).toBe(1);
    });

    it('passes a usable transaction context', async (): Promise<void> => {
      const manager = new FakeTransactionManager();
      const value = await manager.runInTransaction(
        (tx): Promise<number> => tx.executeNative((): Promise<number> => Promise.resolve(7)),
        { userId: 'u1' },
      );
      expect(value).toBe(7);
    });
  });

  describe('FakeEventBus', (): void => {
    it('separates envelopes from legacy raw events', async (): Promise<void> => {
      const bus = new FakeEventBus();
      const event = new ProductArchivedEvent(P1);
      const context = { tenantId: 't', aggregateType: 'Product', aggregateId: 'product-1' };
      await bus.publish([{ event, context }]);
      await bus.publish([event]);
      expect(bus.published).toEqual([{ event, context }]);
      expect(bus.publishedLegacy).toEqual([event]);
    });
  });
});
