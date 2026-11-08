import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { withRolledBackTenant } from '@/testing/integration/with-rolled-back-tenant';

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)('withRolledBackTenant', (): void => {
  let sql: postgres.Sql<Record<string, unknown>>;

  beforeAll((): void => {
    sql = postgres(DATABASE_URL as string);
  });

  afterAll(async (): Promise<void> => {
    await sql.end();
  });

  const countTenants = async (tenantId: string): Promise<number> => {
    const rows = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM core.tenants WHERE id = ${tenantId}
    `;
    return rows[0].n;
  };

  it('exposes a tenant that exists inside the work callback only', async (): Promise<void> => {
    let seenInside = -1;
    let tenantId = '';

    await withRolledBackTenant(sql, async (ctx): Promise<void> => {
      tenantId = ctx.tenantId;
      const rows = await ctx.sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM core.tenants WHERE id = ${ctx.tenantId}
      `;
      seenInside = rows[0].n;
    });

    expect(seenInside).toBe(1);
    expect(await countTenants(tenantId)).toBe(0);
  });

  it('returns the value produced by the work callback', async (): Promise<void> => {
    const result = await withRolledBackTenant(sql, (): Promise<string> => Promise.resolve('done'));

    expect(result).toBe('done');
  });

  it('rolls back and rethrows when the work callback fails', async (): Promise<void> => {
    let tenantId = '';
    const failure = new Error('boom');

    await expect(
      withRolledBackTenant(sql, (ctx): Promise<void> => {
        tenantId = ctx.tenantId;
        return Promise.reject(failure);
      }),
    ).rejects.toBe(failure);

    expect(await countTenants(tenantId)).toBe(0);
  });

  it('gives every call its own tenant', async (): Promise<void> => {
    const first = await withRolledBackTenant(sql, (ctx): Promise<string> =>
      Promise.resolve(ctx.tenantId),
    );
    const second = await withRolledBackTenant(sql, (ctx): Promise<string> =>
      Promise.resolve(ctx.tenantId),
    );

    expect(first).not.toBe(second);
  });
});
