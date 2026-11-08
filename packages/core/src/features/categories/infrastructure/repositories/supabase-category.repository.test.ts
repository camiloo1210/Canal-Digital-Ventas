import { describe, expect, it } from 'vitest';
import { SupabaseCategoryRepository } from '@/categories/infrastructure/repositories/supabase-category.repository';
import { SupabaseCategoryMapper } from '@/categories/infrastructure/mappers/supabase-category.mapper';
import { CategoryRepositoryException } from '@/categories/application/exceptions/category-repository.exception';
import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { buildCategory } from '@/testing/builders/category.builder';
import { FakeSupabase } from '@/testing/fakes/fake-supabase-client';

const tenantId = createTenantId('tenant-1');
const categoryId = createCategoryId('category-1');
const row = SupabaseCategoryMapper.toPersistence(buildCategory());
const TABLE = 'catalog.categories';

function setup(): { fake: FakeSupabase; repo: SupabaseCategoryRepository } {
  const fake = new FakeSupabase();
  return { fake, repo: new SupabaseCategoryRepository(fake.asClient()) };
}

describe('SupabaseCategoryRepository', (): void => {
  describe('searchByFilters', (): void => {
    it('applies all filters and escapes LIKE wildcards in the name', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(TABLE, { data: [row], count: 1 });
      const page = await repo.searchByFilters(
        { tenantId, status: CategoryStatus.ACTIVE, name: '50%_off\\', id: categoryId },
        { page: 2, limit: 5 },
      );
      expect(page).toMatchObject({ totalItems: 1, totalPages: 1, currentPage: 2 });
      const calls = fake.callsFor(TABLE);
      expect(calls).toContainEqual({
        target: TABLE,
        method: 'ilike',
        args: ['name', '%50\\%\\_off\\\\%'],
      });
      expect(calls).toContainEqual({ target: TABLE, method: 'range', args: [5, 9] });
      expect(calls).toContainEqual({ target: TABLE, method: 'eq', args: ['status', 'active'] });
      expect(calls).toContainEqual({ target: TABLE, method: 'eq', args: ['id', categoryId] });
    });

    it('applies only the tenant filter by default and tolerates null data', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(TABLE, { data: null, count: null });
      const page = await repo.searchByFilters({ tenantId });
      expect(page).toEqual({ items: [], totalItems: 0, totalPages: 0, currentPage: 1 });
      expect(fake.callsFor(TABLE).filter((c): boolean => c.method === 'eq')).toHaveLength(1);
    });

    it('throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(TABLE, { error: { message: 'bad' } });
      await expect(repo.searchByFilters({ tenantId })).rejects.toThrow(
        'Failed to search categories: bad',
      );
    });
  });

  describe('findAll', (): void => {
    it('returns a tenant-scoped page', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(TABLE, { data: [row], count: 21 });
      const page = await repo.findAll(tenantId);
      expect(page).toMatchObject({ totalItems: 21, totalPages: 2, currentPage: 1 });
      expect(fake.callsFor(TABLE)).toContainEqual({
        target: TABLE,
        method: 'range',
        args: [0, 19],
      });
    });

    it('handles null data, custom pagination and errors', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(TABLE, { data: null, count: null });
      expect((await repo.findAll(tenantId, { page: 2, limit: 3 })).items).toEqual([]);
      fake.on(TABLE, { error: { message: 'bad' } });
      await expect(repo.findAll(tenantId)).rejects.toThrow(
        'Failed to get categories from this tenant: bad',
      );
    });
  });

  describe('searchCategoriesByName', (): void => {
    it('searches by escaped name inside the tenant', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(TABLE, { data: [row] });
      const found = await repo.searchCategoriesByName('a_b', tenantId);
      expect(found).toHaveLength(1);
      expect(fake.callsFor(TABLE)).toContainEqual({
        target: TABLE,
        method: 'ilike',
        args: ['name', '%a\\_b%'],
      });
    });

    it('returns an empty list for null data and throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(TABLE, { data: null });
      expect(await repo.searchCategoriesByName('x', tenantId)).toEqual([]);
      fake.on(TABLE, { error: { message: 'bad' } });
      await expect(repo.searchCategoriesByName('x', tenantId)).rejects.toBeInstanceOf(
        CategoryRepositoryException,
      );
    });
  });

  describe('findById', (): void => {
    it('returns the category', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(TABLE, { data: row });
      expect((await repo.findById(categoryId, tenantId))?.getId()).toBe('category-1');
    });

    it('returns null for PGRST116 or missing data, throws otherwise', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(TABLE, { error: { code: 'PGRST116', message: 'none' } });
      expect(await repo.findById(categoryId, tenantId)).toBeNull();
      fake.on(TABLE, { data: null });
      expect(await repo.findById(categoryId, tenantId)).toBeNull();
      fake.on(TABLE, { error: { code: '500', message: 'down' } });
      await expect(repo.findById(categoryId, tenantId)).rejects.toThrow(
        'Database error searching category: down',
      );
    });
  });

  describe('save', (): void => {
    it('upserts through the transactional rpc', async (): Promise<void> => {
      const { fake, repo } = setup();
      await repo.save(buildCategory());
      expect(fake.callsFor('rpc:upsert_category_transactional')[0].args).toEqual([
        { category_data: row },
      ]);
    });

    it('maps P0001 to optimistic locking and wraps other errors', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('rpc:upsert_category_transactional', { error: { code: 'P0001', message: 'x' } });
      await expect(repo.save(buildCategory())).rejects.toThrow(/Optimistic locking failure/);
      fake.on('rpc:upsert_category_transactional', { error: { code: '500', message: 'boom' } });
      await expect(repo.save(buildCategory())).rejects.toThrow('Failed to save category: boom');
    });
  });

  describe('countProductsInCategory', (): void => {
    it('counts non archived products of the tenant', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('catalog.products', { count: 4 });
      expect(await repo.countProductsInCategory(categoryId, tenantId)).toBe(4);
      expect(fake.callsFor('catalog.products')).toContainEqual({
        target: 'catalog.products',
        method: 'neq',
        args: ['status', 'archived'],
      });
    });

    it('defaults a null count to zero and throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('catalog.products', { count: null });
      expect(await repo.countProductsInCategory(categoryId, tenantId)).toBe(0);
      fake.on('catalog.products', { error: { message: 'bad' } });
      await expect(repo.countProductsInCategory(categoryId, tenantId)).rejects.toThrow(
        'Failed to count category products: bad',
      );
    });
  });

  describe('deleteById', (): void => {
    it('deletes scoped by id and tenant', async (): Promise<void> => {
      const { fake, repo } = setup();
      await repo.deleteById(categoryId, tenantId);
      const calls = fake.callsFor(TABLE);
      expect(calls.map((c): string => c.method)).toContain('delete');
      expect(calls).toContainEqual({ target: TABLE, method: 'eq', args: ['tenant_id', tenantId] });
    });

    it('throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(TABLE, { error: { message: 'bad' } });
      await expect(repo.deleteById(categoryId, tenantId)).rejects.toThrow(
        'Failed to delete category: bad',
      );
    });
  });
});
