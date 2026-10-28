import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import { RelayOutboxUseCase } from '@/shared/application/use-cases/relay-outbox.use-case';
import { PostgresRelayOutboxAdapter } from '@/shared/infrastructure/adapters/postgres-relay-outbox.adapter';
import { KIVI_PRODUCT_EVENT_TYPES } from '@/kivi/application/kivi-events';
import { computeBackoffMs } from '@/kivi/application/kivi-backoff';
import { KiviDeliveryException } from '@/kivi/application/exceptions/kivi-delivery.exception';
import { SyncKiviProductUseCase } from '@/kivi/application/use-cases/sync-kivi-product.use-case';
import { InitialLoadKiviCatalogUseCase } from '@/kivi/application/use-cases/initial-load-kivi-catalog.use-case';
import { ReconcileKiviCatalogUseCase } from '@/kivi/application/use-cases/reconcile-kivi-catalog.use-case';
import { RunKiviSyncCycleUseCase } from '@/kivi/application/use-cases/run-kivi-sync-cycle.use-case';
import { HttpKiviCatalogGateway } from '@/kivi/infrastructure/http-kivi-catalog.gateway';
import { EnvKiviSecretResolver } from '@/kivi/infrastructure/env-kivi-secret.resolver';
import { KiviCredentialResolver } from '@/kivi/infrastructure/kivi-credential.resolver';
import { loadKiviTokenCipher } from '@/kivi/infrastructure/aes-gcm-kivi-token.cipher';
import { KiviOutboxEventPublisher } from '@/kivi/infrastructure/kivi-outbox-event.publisher';
import { PostgresKiviSyncStoreAdapter } from '@/kivi/infrastructure/postgres-kivi-sync-store.adapter';
import type { KiviSyncWorkerConfig } from '@/kivi/infrastructure/kivi-sync-worker-config';

export interface KiviSyncWorkerLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const SCHEDULER_TICK_MS = 30_000;

/**
 * Worker composition root: relays Product outbox events to Kivi (complete only on confirmed
 * acceptance) and periodically runs initial loads and reconciliations. Log lines are static
 * strings or counters: no URLs, tokens or payloads.
 */
export async function runKiviSyncWorker(
  config: KiviSyncWorkerConfig,
  env: Record<string, string | undefined>,
  signal: AbortSignal,
  logger: KiviSyncWorkerLogger,
  onReady: (ready: boolean) => void = (): void => {},
): Promise<void> {
  const sql = postgres(config.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
    connection: { statement_timeout: 10_000, application_name: 'canaldigital-kivi-sync' },
  });
  const urlOptions = { allowLocalDevelopment: config.allowLocalDevelopment };
  const store = new PostgresKiviSyncStoreAdapter(sql, urlOptions);
  const gateway = new HttpKiviCatalogGateway({ urlOptions });
  const secrets = new KiviCredentialResolver(
    loadKiviTokenCipher(env),
    new EnvKiviSecretResolver(env),
  );
  const sync = new SyncKiviProductUseCase(store, gateway, secrets);
  const relay = new RelayOutboxUseCase(
    new PostgresRelayOutboxAdapter(sql, crypto.randomUUID(), KIVI_PRODUCT_EVENT_TYPES, 'Product'),
    new KiviOutboxEventPublisher(sync),
  );
  const cycle = new RunKiviSyncCycleUseCase(
    store,
    new InitialLoadKiviCatalogUseCase(store, gateway, secrets),
    new ReconcileKiviCatalogUseCase(store, gateway, secrets),
    { reconcileIntervalMs: config.reconcileIntervalMs, retryIntervalMs: config.retryIntervalMs },
  );

  let failures = 0;
  let nextCycleAt = 0;
  try {
    logger.info('Kivi sync worker started');
    while (!signal.aborted) {
      let wait = 0;
      try {
        const processed = await relay.execute();
        failures = 0;
        onReady(true);
        if (Date.now() >= nextCycleAt) {
          nextCycleAt = Date.now() + SCHEDULER_TICK_MS;
          const result = await cycle.execute(new Date());
          if (result.deadEventFlags > 0) {
            logger.warn(
              `Kivi sync: outbox events exhausted retries; stores flagged for reconcile=${result.deadEventFlags}`,
            );
          }
          if (result.divergencesResolved > 0) {
            logger.warn(
              `Kivi sync: Kivi was ahead of Canal; products re-based from Canal=${result.divergencesResolved}`,
            );
          }
          if (result.initialLoads + result.reconciles + result.failures > 0) {
            logger.info(
              `Kivi sync cycle: initialLoads=${result.initialLoads} reconciles=${result.reconciles} failures=${result.failures}`,
            );
          }
        }
        if (!processed) wait = config.pollIntervalMs;
      } catch (error: unknown) {
        failures++;
        onReady(false);
        const retryAfterMs = error instanceof KiviDeliveryException ? error.retryAfterMs : null;
        wait = computeBackoffMs(failures, retryAfterMs);
        logger.error('Kivi sync interrupted; backing off');
      }
      if (wait > 0) await pause(wait, signal);
    }
  } finally {
    onReady(false);
    await sql.end({ timeout: 5 });
  }
}

async function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  try {
    await delay(milliseconds, undefined, { signal });
  } catch (error: unknown) {
    if (!signal.aborted) throw error;
  }
}
