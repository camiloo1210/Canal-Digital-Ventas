import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresAdminCatalogReadAdapter } from '@/dashboard/infrastructure/postgres-admin-catalog-read.adapter';
import { AdminCatalogReadException } from '@/dashboard/application/exceptions/admin-catalog-read.exception';
import type { AdminCatalogQuery } from '@/dashboard/application/ports/out/admin-catalog-read.port';

const query: AdminCatalogQuery = { q: '50%_\\', status: 'archived', page: 3, limit: 25 };

describe('admin catalog read projection', (): void => {
  it('scopes product search by actor and tenant and requests records after the first 50', async (): Promise<void> => {
    const sql = vi
      .fn()
      .mockResolvedValue([{ total: 51, items: [{ id: 'product-51', priceCents: 12345 }] }]);
    const repository = new PostgresAdminCatalogReadAdapter(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const result = await repository.findProductsForManager('actor', 'tenant', query);
    expect(result).toMatchObject({
      totalItems: 51,
      totalPages: 3,
      currentPage: 3,
      items: [{ id: 'product-51', priceCents: 12345 }],
    });
    const [parts, ...values] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const statement = parts.join('?');
    expect(values).toEqual([
      'tenant',
      'actor',
      'archived',
      'archived',
      query.q,
      '%50\\%\\_\\\\%',
      '%50\\%\\_\\\\%',
      25,
      50,
    ]);
    expect(statement).toContain("m.status='active' AND m.role IN ('OWNER','ADMIN')");
    expect(statement).toContain('m.user_id=?::uuid');
    expect(statement).toContain('t.id=?::uuid');
    expect(statement).toContain('p.tenant_id');
    expect(statement).toContain('c.tenant_id=p.tenant_id');
    expect(statement).toContain('p.name ILIKE ? OR p.sku ILIKE ?');
    expect(statement).toContain('SELECT count(*)::int FROM filtered');
    expect(statement).toContain('ORDER BY created_at DESC,id DESC');
    expect(statement).not.toContain('50%_');
    expect(sql).toHaveBeenCalledTimes(1);
  });
  it('scopes category counts and product associations to the same tenant', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([{ total: 0, items: [] }]);
    const repository = new PostgresAdminCatalogReadAdapter(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    expect(
      await repository.findCategoriesForManager('actor', 'tenant', { ...query, page: 1 }),
    ).toEqual({ totalItems: 0, totalPages: 1, currentPage: 1, items: [] });
    const [parts, ...values] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(parts.join('?')).toContain('p.tenant_id=c.tenant_id AND p.category_id=c.id');
    expect(parts.join('?')).toContain('ORDER BY c.created_at DESC,c.id DESC');
    expect(values).toContain('actor');
    expect(values).toContain('tenant');
    expect(values.at(-1)).toBe(0);
  });
  it('returns null for unavailable membership instead of an empty catalog', async (): Promise<void> => {
    const repository = new PostgresAdminCatalogReadAdapter(
      vi.fn().mockResolvedValue([]) as unknown as postgres.Sql<Record<string, unknown>>,
    );
    expect(await repository.findProductsForManager('outsider', 'tenant', query)).toBeNull();
    expect(await repository.findCategoriesForManager('outsider', 'tenant', query)).toBeNull();
  });
  it('translates vendor errors on both read paths', async (): Promise<void> => {
    const repository = new PostgresAdminCatalogReadAdapter(
      vi.fn().mockRejectedValue(new Error('database detail')) as unknown as postgres.Sql<
        Record<string, unknown>
      >,
    );
    await expect(repository.findProductsForManager('actor', 'tenant', query)).rejects.toThrow(
      AdminCatalogReadException,
    );
    await expect(repository.findCategoriesForManager('actor', 'tenant', query)).rejects.toThrow(
      AdminCatalogReadException,
    );
  });
});
