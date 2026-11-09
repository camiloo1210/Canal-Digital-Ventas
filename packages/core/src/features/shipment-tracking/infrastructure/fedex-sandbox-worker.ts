import postgres from 'postgres';
import { setTimeout as delay } from 'node:timers/promises';
import { TrackingAuthorizationException } from '@/shipment-tracking/application/tracking-authorization.exception';
import { assertSandboxEnvironment } from '@/shipment-tracking/application/use-cases/sandbox-environment';
import { PollTrackingUseCase } from '@/shipment-tracking/application/use-cases/poll-tracking.use-case';
import { PostgresTrackingRepository } from '@/shipment-tracking/infrastructure/postgres-tracking.repository';
import {
  FedexAuthAdapter,
  FedexTrackingException,
} from '@/shipment-tracking/infrastructure/fedex/fedex-auth.adapter';
import { FedexTrackingAdapter } from '@/shipment-tracking/infrastructure/fedex/fedex-tracking.adapter';
import { runTrackingLoop } from '@/shipment-tracking/infrastructure/tracking-worker';

export interface FedexSandboxWorkerConfig {
  readonly databaseUrl: string;
  readonly productionDatabaseUrl: string;
  readonly deploymentId: string;
  readonly nodeEnv: string;
  readonly sandboxEnabled: boolean;
  readonly appEnv: string;
  readonly credentials: Readonly<
    Record<string, { readonly clientId: string; readonly clientSecret: string }>
  >;
  readonly intervalMs: number;
  readonly minimumSpacingMs?: number;
  readonly terminalIntervalMs?: number;
  readonly retentionDays?: number;
}
export async function runFedexSandboxWorker(
  config: FedexSandboxWorkerConfig,
  signal: AbortSignal,
  connect: (url: string) => postgres.Sql<Record<string, unknown>> = (
    url,
  ): postgres.Sql<Record<string, unknown>> =>
    postgres(url, { max: 1, prepare: false, connect_timeout: 10 }),
  fetcher: typeof fetch = fetch,
  observe: (result: 'applied' | 'stale' | 'paused' | 'error') => void = (): void => {},
  observeMetrics: (
    metrics: Awaited<ReturnType<PostgresTrackingRepository['readOperationalMetrics']>>,
  ) => void = (): void => {},
): Promise<void> {
  const guard = {
    nodeEnv: config.nodeEnv,
    sandboxEnabled: config.sandboxEnabled,
    appEnv: config.appEnv,
    expectedDeploymentId: config.deploymentId,
    testDatabaseUrl: config.databaseUrl,
    productionDatabaseUrl: config.productionDatabaseUrl,
  };
  assertSandboxEnvironment({
    ...guard,
    databaseEnvironment: 'sandbox',
    databaseDeploymentId: config.deploymentId,
  });
  const sql = connect(config.databaseUrl);
  try {
    const rows = await sql<
      { environment: string; deployment_id: string; authorized: boolean }[]
    >`SELECT environment, deployment_id::text, pg_catalog.pg_has_role(session_user, 'shipment_tracking_worker_role', 'MEMBER') AS authorized FROM sales.shipment_tracking_environment WHERE singleton`;
    const row = rows[0];
    if (!row || !row.authorized)
      throw new FedexTrackingException('Tracking sandbox authorization failed');
    assertSandboxEnvironment({
      ...guard,
      databaseEnvironment: row.environment,
      databaseDeploymentId: row.deployment_id,
    });
    const auth = new FedexAuthAdapter(
      {
        resolve: async (ref): Promise<{ clientId: string; clientSecret: string }> => {
          const credentials = config.credentials[ref];
          if (!credentials) throw new TrackingAuthorizationException();
          return credentials;
        },
      },
      fetcher,
    );
    const retentionDays = config.retentionDays ?? 90;
    if (!Number.isSafeInteger(retentionDays) || retentionDays < 90 || retentionDays > 3650)
      throw new FedexTrackingException('Invalid retention configuration');
    const repository = new PostgresTrackingRepository(
      sql,
      config.intervalMs,
      config.terminalIntervalMs,
    );
    const poller = new PollTrackingUseCase(repository, new FedexTrackingAdapter(auth, fetcher));
    await runTrackingLoop(
      poller,
      signal,
      async (milliseconds, abortSignal): Promise<void> => {
        try {
          await delay(milliseconds, undefined, { signal: abortSignal });
        } catch (error: unknown) {
          if (!abortSignal.aborted) throw error;
        }
      },
      undefined,
      undefined,
      undefined,
      (result): void => {
        if (result !== 'idle') observe(result);
      },
      config.minimumSpacingMs ?? 1000,
      async (now): Promise<void> =>
        repository.purgeExpired(new Date(Date.parse(now) - retentionDays * 86400000).toISOString()),
      async (): Promise<void> => observeMetrics(await repository.readOperationalMetrics()),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
