import type { KiviSyncStorePort } from '@/kivi/application/ports/out/kivi-sync-store.port';
import type { InitialLoadResult } from '@/kivi/application/use-cases/initial-load-kivi-catalog.use-case';
import type { ReconcileResult } from '@/kivi/application/use-cases/reconcile-kivi-catalog.use-case';

export interface KiviSyncCycleOptions {
  /** A linked store is reconciled at least this often. */
  reconcileIntervalMs: number;
  /** Minimum spacing between attempts for the same store (throttles failing/diverged stores). */
  retryIntervalMs: number;
}

export interface KiviSyncCycleResult {
  initialLoads: number;
  reconciles: number;
  failures: number;
  /** Connections flagged because their Product outbox events were exhausted (DEAD). */
  deadEventFlags: number;
  /** Products re-based above a newer Kivi version during reconciliation. */
  divergencesResolved: number;
}

/** One scheduler tick: initial loads for new links, periodic/flagged reconciliations. */
export class RunKiviSyncCycleUseCase {
  public constructor(
    private readonly store: Pick<
      KiviSyncStorePort,
      'claimConnectionsDue' | 'flagConnectionsWithDeadProductEvents'
    >,
    private readonly initialLoad: {
      execute(tenantId: string, now: Date): Promise<InitialLoadResult>;
    },
    private readonly reconcile: { execute(tenantId: string, now: Date): Promise<ReconcileResult> },
    private readonly options: KiviSyncCycleOptions,
  ) {}

  public async execute(now: Date): Promise<KiviSyncCycleResult> {
    // Outbox retries give up (DEAD) after a short outage; flag those stores for reconcile first
    // so the same tick repairs what the relay abandoned instead of waiting for the periodic run.
    const deadEventFlags = await this.store.flagConnectionsWithDeadProductEvents();
    const staleBefore = new Date(now.getTime() - this.options.reconcileIntervalMs);
    const due = await this.store.claimConnectionsDue(
      staleBefore,
      now,
      new Date(now.getTime() + this.options.retryIntervalMs),
    );
    const result: KiviSyncCycleResult = {
      initialLoads: 0,
      reconciles: 0,
      failures: 0,
      deadEventFlags,
      divergencesResolved: 0,
    };
    for (const connection of due) {
      const tenantId = connection.getTenantId();
      try {
        if (connection.getStatus() === 'pending') {
          await this.initialLoad.execute(tenantId, now);
          result.initialLoads++;
        } else {
          const reconciled = await this.reconcile.execute(tenantId, now);
          result.reconciles++;
          result.divergencesResolved += reconciled.divergencesResolved;
        }
      } catch {
        // Per-store isolation; the error carries no secrets and the store is retried later.
        result.failures++;
      }
    }
    return result;
  }
}
