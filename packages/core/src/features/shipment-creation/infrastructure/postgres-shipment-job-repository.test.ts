import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import {
  PostgresShipmentJobRepository,
  ShipmentJobRepositoryException,
} from '@/shipment-creation/infrastructure/postgres-shipment-job-repository';
import { ShipmentRetryNotAllowedException } from '@/shipment-creation/application/exceptions/shipment-retry-not-allowed.exception';
import type { ClaimedJob } from '@/shipment-creation/application/ports/out/shipment-job-repository.port';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER = '22222222-2222-4222-8222-222222222222';
const TOKEN = '33333333-3333-4333-8333-333333333333';
const job: ClaimedJob = {
  tenantId: TENANT,
  orderId: ORDER,
  leaseToken: TOKEN,
  leaseSeconds: 120,
  attempts: 1,
  claimedFrom: 'queued',
};
type Query = ReturnType<typeof vi.fn>;
const asSql = (query: Query): postgres.Sql<Record<string, unknown>> =>
  query as unknown as postgres.Sql<Record<string, unknown>>;
const text = (query: Query, call = 0): string =>
  (query.mock.calls[call]?.[0] as TemplateStringsArray).join('?');
const txWith = (query: Query): TransactionContext => ({
  executeNative: async <C, R>(fn: (connection: C) => Promise<R>): Promise<R> =>
    fn(query as unknown as C),
});

describe('postgres shipment job repository', (): void => {
  it('claims queued jobs and crashed creating jobs with an expired lease', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([
      {
        tenant_id: TENANT,
        order_id: ORDER,
        lease_token: TOKEN,
        attempts: 2,
        claimed_from: 'creating',
      },
    ]);
    const claimed = await new PostgresShipmentJobRepository(
      asSql(query),
      (): string => TOKEN,
    ).claimNext(new Date('2026-11-09T00:00:00Z'), 120);
    expect(claimed).toEqual({ ...job, attempts: 2, claimedFrom: 'creating' });
    const sql = text(query);
    expect(sql).toContain("state IN ('queued', 'creating')");
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('c.state AS claimed_from');
  });

  it('returns null when nothing is due and rejects unsafe leases', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PostgresShipmentJobRepository(asSql(query));
    expect(await repository.claimNext(new Date(), 120)).toBeNull();
    await expect(repository.claimNext(new Date(), 5)).rejects.toBeInstanceOf(
      ShipmentJobRepositoryException,
    );
  });

  it('marks creating only from queued under a live lease', async (): Promise<void> => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ order_id: ORDER }])
      .mockResolvedValueOnce([]);
    const repository = new PostgresShipmentJobRepository(asSql(query));
    expect(await repository.markCreating(job)).toBe(true);
    expect(await repository.markCreating(job)).toBe(false);
    const sql = text(query);
    expect(sql).toContain("SET state = 'creating'");
    expect(sql).toContain("AND state = 'queued' AND lease_token = ");
    expect(sql).toContain('lease_until > clock_timestamp()');
  });

  it('completes inside the caller transaction and fails when the lease was lost', async (): Promise<void> => {
    const tx = vi
      .fn()
      .mockResolvedValueOnce([{ order_id: ORDER }])
      .mockResolvedValueOnce([]);
    const repository = new PostgresShipmentJobRepository(asSql(vi.fn()));
    await repository.complete(job, `${TENANT}/label.pdf`, txWith(tx));
    expect(text(tx)).toContain("SET state = 'done'");
    expect(tx.mock.calls[0]).toContain(`${TENANT}/label.pdf`);
    await expect(
      repository.complete(job, `${TENANT}/label.pdf`, txWith(tx)),
    ).rejects.toBeInstanceOf(ShipmentJobRepositoryException);
    await expect(
      repository.complete(job, 'other-tenant/label.pdf', txWith(tx)),
    ).rejects.toBeInstanceOf(ShipmentJobRepositoryException);
  });

  it('fences terminal transitions by lease token and sanitizes failure reasons', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PostgresShipmentJobRepository(asSql(query));
    await repository.markNeedsAttention(job, 'AMBIGUOUS_RESULT');
    await repository.markFailed(job, 'SHIPMENT.INVALID');
    await repository.markFailed(job, 'raw <body> with secrets');
    expect(text(query)).toContain('lease_token = ');
    expect(query.mock.calls[0]).toContain('needs_attention');
    expect(query.mock.calls[0]).toContain('AMBIGUOUS_RESULT');
    expect(query.mock.calls[1]).toContain('SHIPMENT.INVALID');
    expect(query.mock.calls[2]).toContain('PROVIDER_REJECTED');
    expect(query.mock.calls[2]).not.toContain('raw <body> with secrets');
  });

  it('retries only from needs_attention or failed for an order manager', async (): Promise<void> => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ updated: 1, blocked: 0 }])
      .mockResolvedValueOnce([{ updated: 0, blocked: 0 }]);
    const repository = new PostgresShipmentJobRepository(asSql(query));
    expect(await repository.retry(TENANT, ORDER, 'actor')).toBe(true);
    expect(await repository.retry(TENANT, ORDER, 'actor')).toBe(false);
    const sql = text(query);
    expect(sql).toContain("j.state IN ('needs_attention', 'failed')");
    expect(sql).toContain("ARRAY['MANAGE_ORDERS']");
    expect(sql).toContain('provider_tracking_number IS NULL');
  });

  it('refuses a retry once the carrier returned a tracking number', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([{ updated: 0, blocked: 1 }]);
    await expect(
      new PostgresShipmentJobRepository(asSql(query)).retry(TENANT, ORDER, 'actor'),
    ).rejects.toBeInstanceOf(ShipmentRetryNotAllowedException);
  });

  it('completes without a label as LABEL_UNAVAILABLE', async (): Promise<void> => {
    const tx = vi.fn().mockResolvedValue([{ order_id: ORDER }]);
    await new PostgresShipmentJobRepository(asSql(vi.fn())).complete(job, null, txWith(tx));
    expect(text(tx)).toContain("SET state = 'done'");
    expect(tx.mock.calls[0]).toContain('LABEL_UNAVAILABLE');
    expect(tx.mock.calls[0]).toContain(null);
  });

  it('keeps the carrier tracking number when marking ambiguous', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PostgresShipmentJobRepository(asSql(query));
    await repository.markNeedsAttention(job, 'AMBIGUOUS_RESULT', '794600000001');
    await repository.markNeedsAttention(job, 'MISSING_ORIGIN');
    expect(text(query)).toContain('provider_tracking_number = COALESCE(');
    expect(query.mock.calls[0]).toContain('794600000001');
    expect(query.mock.calls[1]).toContain(null);
  });

  it('records the carrier tracking number without depending on the lease', async (): Promise<void> => {
    const query = vi.fn().mockResolvedValue([]);
    await new PostgresShipmentJobRepository(asSql(query)).recordProviderTrackingNumber(
      job,
      '794600000001',
    );
    const sql = text(query);
    expect(sql).toContain('SET provider_tracking_number = ');
    expect(sql).toContain("state <> 'done'");
    expect(sql).toContain('provider_tracking_number IS NULL');
    expect(sql).not.toContain('lease_token');
    expect(sql).not.toContain('lease_until');
    expect(query.mock.calls[0]).toEqual(expect.arrayContaining(['794600000001', ORDER, TENANT]));
    expect(query.mock.calls[0]).not.toContain(TOKEN);
    await expect(
      new PostgresShipmentJobRepository(
        asSql(vi.fn().mockRejectedValue(new Error('boom'))),
      ).recordProviderTrackingNumber(job, '794600000001'),
    ).rejects.toBeInstanceOf(ShipmentJobRepositoryException);
  });

  it('translates driver failures', async (): Promise<void> => {
    const query = vi.fn().mockRejectedValue(new Error('boom'));
    const repository = new PostgresShipmentJobRepository(asSql(query));
    await expect(repository.markCreating(job)).rejects.toBeInstanceOf(
      ShipmentJobRepositoryException,
    );
    await expect(repository.retry(TENANT, ORDER, 'a')).rejects.toBeInstanceOf(
      ShipmentJobRepositoryException,
    );
  });
});
