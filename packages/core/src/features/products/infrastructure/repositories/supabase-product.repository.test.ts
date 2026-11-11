import { describe, expect, it } from 'vitest';
import { SupabaseProductRepository } from '@/products/infrastructure/repositories/supabase-product.repository';
import { SupabaseProductMapper } from '@/products/infrastructure/mappers/supabase-product.mapper';
import { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { buildProduct } from '@/testing/builders/product.builder';
import { FakeSupabase } from '@/testing/fakes/fake-supabase-client';

const tenantId = createTenantId('tenant-1');
const row = SupabaseProductMapper.toPersistence(buildProduct());
const PRODUCTS = 'catalog.products';
const TENANTS = 'core.tenants';

function setup(): { fake: FakeSupabase; repo: SupabaseProductRepository } {
  const fake = new FakeSupabase().on(TENANTS, { data: { base_currency: Currency.COP } });
  return { fake, repo: new SupabaseProductRepository(fake.asClient()) };
}

describe('SupabaseProductRepository (read side)', (): void => {
  describe('searchByFilters', (): void => {
    it('applies all filters and resolves the tenant currency', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { data: [row], count: 1 });
      const page = await repo.searchByFilters(
        {
          tenantId,
          status: ProductStatus.ACTIVE,
          categoryId: createCategoryId('category-1'),
          sku: 'SKU-00001',
          name: 'test',
          id: createProductId('product-1'),
        },
        { page: 2, limit: 5 },
      );
      expect(page).toMatchObject({ totalItems: 1, totalPages: 1, currentPage: 2 });
      expect(page.items[0].getPrice().getCurrency()).toBe('COP');
      const calls = fake.callsFor(PRODUCTS);
      expect(calls).toContainEqual({ target: PRODUCTS, method: 'ilike', args: ['name', '%test%'] });
      expect(calls).toContainEqual({ target: PRODUCTS, method: 'range', args: [5, 9] });
      expect(calls).toContainEqual({ target: PRODUCTS, method: 'eq', args: ['sku', 'SKU-00001'] });
    });

    it('uses only the tenant filter by default and tolerates null data', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { data: null, count: null });
      const page = await repo.searchByFilters({ tenantId });
      expect(page).toEqual({ items: [], totalItems: 0, totalPages: 0, currentPage: 1 });
      expect(fake.callsFor(PRODUCTS).filter((c): boolean => c.method === 'eq')).toHaveLength(1);
    });

    it('throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { error: { message: 'bad' } });
      await expect(repo.searchByFilters({ tenantId })).rejects.toThrow(
        'Failed to search products: bad',
      );
    });

    it('fails when the tenant currency cannot be resolved', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { data: [row], count: 1 });
      fake.on(TENANTS, { data: null });
      await expect(repo.searchByFilters({ tenantId })).rejects.toThrow(
        'Failed to resolve product currency.',
      );
    });
  });

  describe('findAll', (): void => {
    it('returns a tenant-scoped page', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { data: [row], count: 21 });
      expect(await repo.findAll(tenantId)).toMatchObject({ totalItems: 21, totalPages: 2 });
    });

    it('handles null data, pagination and errors', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { data: null, count: null });
      expect((await repo.findAll(tenantId, { page: 2, limit: 3 })).items).toEqual([]);
      fake.on(PRODUCTS, { error: { message: 'bad' } });
      await expect(repo.findAll(tenantId)).rejects.toThrow(
        'Failed to get products from this tenant: bad',
      );
    });
  });

  describe('searchProductsByName', (): void => {
    it('searches and maps', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { data: [row] });
      expect(await repo.searchProductsByName('test', tenantId)).toHaveLength(1);
    });

    it('returns empty for null data and throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { data: null });
      expect(await repo.searchProductsByName('x', tenantId)).toEqual([]);
      fake.on(PRODUCTS, { error: { message: 'bad' } });
      await expect(repo.searchProductsByName('x', tenantId)).rejects.toThrow(
        'Failed to search products: bad',
      );
    });
  });

  describe('findByCategoryId', (): void => {
    it('filters by tenant and category', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { data: [row] });
      expect(await repo.findByCategoryId(createCategoryId('category-1'), tenantId)).toHaveLength(1);
      expect(fake.callsFor(PRODUCTS)).toContainEqual({
        target: PRODUCTS,
        method: 'eq',
        args: ['category_id', 'category-1'],
      });
    });

    it('returns empty for null data and throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { data: null });
      expect(await repo.findByCategoryId(createCategoryId('c'), tenantId)).toEqual([]);
      fake.on(PRODUCTS, { error: { message: 'bad' } });
      await expect(repo.findByCategoryId(createCategoryId('c'), tenantId)).rejects.toThrow(
        'Failed to find products by category: bad',
      );
    });
  });

  describe('findById', (): void => {
    it('returns the product with the tenant currency', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { data: row });
      const found = await repo.findById(createProductId('product-1'), tenantId);
      expect(found?.getPrice().getCurrency()).toBe('COP');
    });

    it('returns null for PGRST116 or missing data, throws otherwise', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(PRODUCTS, { error: { code: 'PGRST116', message: 'none' } });
      expect(await repo.findById(createProductId('p'), tenantId)).toBeNull();
      fake.on(PRODUCTS, { data: null });
      expect(await repo.findById(createProductId('p'), tenantId)).toBeNull();
      fake.on(PRODUCTS, { error: { code: '500', message: 'down' } });
      await expect(repo.findById(createProductId('p'), tenantId)).rejects.toThrow(
        'Database error searching product: down',
      );
    });
  });

  describe('write operations', (): void => {
    it('are rejected because the adapter is read-only', async (): Promise<void> => {
      const { repo } = setup();
      for (const call of [
        (): Promise<unknown> => repo.save(),
        (): Promise<unknown> => repo.delete(),
        (): Promise<unknown> => repo.decreaseStock(),
        (): Promise<unknown> => repo.increaseStock(),
      ]) {
        await expect(call()).rejects.toBeInstanceOf(ProductRepositoryException);
        await expect(call()).rejects.toThrow(/read-only/);
      }
    });
  });
});
