import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresKiviOrderLookupReadRepository } from '@/kivi/infrastructure/postgres-kivi-order-lookup-read.repository';
import { KiviOrderLookupReadException } from '@/kivi/infrastructure/kivi-order-lookup-read.exception';

const TENANT = '11111111-1111-4111-8111-111111111111';

interface Call {
  text: string;
  values: unknown[];
}

function fakeSql(results: unknown[][]): {
  sql: postgres.Sql<Record<string, unknown>>;
  calls: Call[];
} {
  const calls: Call[] = [];
  const queue = [...results];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
    calls.push({ text: strings.join('?'), values });
    return Promise.resolve(queue.shift() ?? []);
  };
  return { sql: tag as unknown as postgres.Sql<Record<string, unknown>>, calls };
}

describe('PostgresKiviOrderLookupReadRepository', (): void => {
  it('returns empty without querying orders when the store has no active connection', async (): Promise<void> => {
    const { sql, calls } = fakeSql([[]]);
    const repo = new PostgresKiviOrderLookupReadRepository(sql);
    await expect(
      repo.findLatestOrders({ tenantId: TENANT, phone: '573001112233', orderNumber: null }),
    ).resolves.toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('parameterizes every input and maps rows', async (): Promise<void> => {
    const { sql, calls } = fakeSql([
      [{ tenant_id: TENANT }],
      [{ order_number: 'ORD-1', status: 'shipped', updated_at: new Date('2026-10-01T10:00:00Z') }],
    ]);
    const repo = new PostgresKiviOrderLookupReadRepository(sql);
    const result = await repo.findLatestOrders({
      tenantId: TENANT,
      phone: '573001112233',
      orderNumber: ' #Ord-1 ',
    });
    expect(result).toEqual([
      { orderNumber: 'ORD-1', status: 'shipped', updatedAt: '2026-10-01T10:00:00.000Z' },
    ]);
    expect(calls[0].values).toEqual([TENANT]);
    expect(calls[0].text).toContain('k.tenant_id =');
    expect(calls[1].values).toContain(TENANT);
    expect(calls[1].values).toContain('573001112233');
    expect(calls[1].values).toContain('ord-1');
    expect(calls[1].text).not.toContain('573001112233');
    expect(calls[1].text).toContain("o.status <> 'draft'");
    expect(calls[1].text).toContain('LIMIT 5');
  });

  it('translates driver failures without leaking them', async (): Promise<void> => {
    const sql = vi.fn().mockRejectedValue(new Error('boom 573001112233'));
    const repo = new PostgresKiviOrderLookupReadRepository(
      sql as unknown as postgres.Sql<Record<string, unknown>>,
    );
    const failure = repo.findLatestOrders({
      tenantId: TENANT,
      phone: '573001112233',
      orderNumber: null,
    });
    await expect(failure).rejects.toBeInstanceOf(KiviOrderLookupReadException);
    await expect(failure).rejects.toHaveProperty('message', 'Kivi order lookup read failed');
  });
});
