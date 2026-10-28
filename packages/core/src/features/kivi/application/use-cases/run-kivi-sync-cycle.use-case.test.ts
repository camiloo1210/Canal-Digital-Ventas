import { describe, expect, it } from 'vitest';
import { RunKiviSyncCycleUseCase } from '@/kivi/application/use-cases/run-kivi-sync-cycle.use-case';
import { computeBackoffMs } from '@/kivi/application/kivi-backoff';
import { KiviDeliveryException } from '@/kivi/application/exceptions/kivi-delivery.exception';
import { connection, TENANT } from '@/kivi/application/kivi-test-doubles';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';

const T0 = new Date('2026-10-27T12:00:00Z');

function harness(
  due: KiviConnection[],
  failTenant = false,
  deadFlags = 0,
  resolved = 0,
): {
  initial: string[];
  reconciled: string[];
  order: string[];
  useCase: RunKiviSyncCycleUseCase;
} {
  const initial: string[] = [];
  const reconciled: string[] = [];
  const order: string[] = [];
  let eligibleAt = 0;
  const store = {
    claimConnectionsDue: async (
      _staleBefore: Date,
      now: Date,
      retryAfter: Date,
    ): Promise<KiviConnection[]> => {
      if (now.getTime() < eligibleAt) return [];
      eligibleAt = retryAfter.getTime();
      return due;
    },
    flagConnectionsWithDeadProductEvents: async (): Promise<number> => {
      order.push('flag');
      return deadFlags;
    },
  };
  const useCase = new RunKiviSyncCycleUseCase(
    store,
    {
      execute: async (tenantId: string): Promise<{ sent: number; conflicts: number }> => {
        if (failTenant) throw new KiviDeliveryException('transient');
        initial.push(tenantId);
        return { sent: 0, conflicts: 0 };
      },
    },
    {
      execute: async (
        tenantId: string,
      ): Promise<{
        sent: number;
        deleted: number;
        diverged: number;
        divergencesResolved: number;
        unmappedKiviProducts: number;
      }> => {
        order.push('reconcile');
        reconciled.push(tenantId);
        return {
          sent: 0,
          deleted: 0,
          diverged: 0,
          divergencesResolved: resolved,
          unmappedKiviProducts: 0,
        };
      },
    },
    { reconcileIntervalMs: 6 * 3_600_000, retryIntervalMs: 60_000 },
  );
  return { initial, reconciled, order, useCase };
}

describe('RunKiviSyncCycleUseCase', (): void => {
  it('runs the initial load for pending links and reconciliation for the others', async (): Promise<void> => {
    const pending = harness([connection('pending')]);
    expect(await pending.useCase.execute(T0)).toEqual({
      initialLoads: 1,
      reconciles: 0,
      failures: 0,
      deadEventFlags: 0,
      divergencesResolved: 0,
    });
    expect(pending.initial).toEqual([TENANT]);
    const flagged = harness([connection('needs_reconcile')]);
    expect(await flagged.useCase.execute(T0)).toEqual({
      initialLoads: 0,
      reconciles: 1,
      failures: 0,
      deadEventFlags: 0,
      divergencesResolved: 0,
    });
    expect(flagged.reconciled).toEqual([TENANT]);
  });

  it('throttles repeated attempts for the same store', async (): Promise<void> => {
    const h = harness([connection('needs_reconcile')]);
    await h.useCase.execute(T0);
    await h.useCase.execute(new Date(T0.getTime() + 30_000));
    expect(h.reconciled).toHaveLength(1);
    await h.useCase.execute(new Date(T0.getTime() + 61_000));
    expect(h.reconciled).toHaveLength(2);
  });

  it('flags dead Product events before listing due stores and reports the count', async (): Promise<void> => {
    const h = harness([connection('needs_reconcile')], false, 2);
    const result = await h.useCase.execute(T0);
    expect(h.order).toEqual(['flag', 'reconcile']);
    expect(result.deadEventFlags).toBe(2);
  });

  it('sums resolved divergences from reconciliations', async (): Promise<void> => {
    const h = harness([connection('needs_reconcile')], false, 0, 3);
    expect((await h.useCase.execute(T0)).divergencesResolved).toBe(3);
  });

  it('counts a failing store without aborting the cycle or throwing', async (): Promise<void> => {
    const h = harness([connection('pending')], true);
    expect(await h.useCase.execute(T0)).toEqual({
      initialLoads: 0,
      reconciles: 0,
      failures: 1,
      deadEventFlags: 0,
      divergencesResolved: 0,
    });
  });
});

describe('computeBackoffMs', (): void => {
  it('grows exponentially, is jittered within [base/2, base] and is capped', (): void => {
    expect(computeBackoffMs(1, null, (): number => 0)).toBe(500);
    expect(computeBackoffMs(1, null, (): number => 1)).toBe(1000);
    expect(computeBackoffMs(3, null, (): number => 1)).toBe(4000);
    expect(computeBackoffMs(30, null, (): number => 1)).toBe(30_000);
  });

  it('never waits less than Retry-After', (): void => {
    expect(computeBackoffMs(1, 15_000, (): number => 0)).toBe(15_000);
    expect(computeBackoffMs(1, 900_000, (): number => 0)).toBe(120_000);
  });
});
