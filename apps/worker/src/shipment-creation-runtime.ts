import postgres from 'postgres';
import { setTimeout as delay } from 'node:timers/promises';
import type { ClaimedJob } from '@canaldigital/packages/core';
import {
  CreateShipmentUseCase,
  FedexAuthAdapter,
  FedexShipAdapter,
  PostgresCarrierShipmentRecordAdapter,
  PostgresShipmentCreationSource,
  PostgresShipmentJobRepository,
  PostgresShippingOriginRepository,
  PostgresTrackingActivationAdapter,
  PostgresTransactionManagerAdapter,
  SupabaseLabelStorageAdapter,
  TrackingAuthorizationException,
  assertSandboxEnvironment,
  createLabelStorageClient,
} from '@canaldigital/packages/core';
import type { ShipmentCreationConfig } from '@/worker/shipment-creation-config';
import { runShipmentCreationLoop } from '@/worker/shipment-creation-loop';

/** Remembers which leases attempted the `creating` commit, i.e. may have reached the carrier. */
export class TrackingShipmentJobRepository extends PostgresShipmentJobRepository {
  private readonly creating = new Set<string>();

  public wasMarkedCreating(job: ClaimedJob): boolean {
    return this.creating.has(job.leaseToken);
  }

  public override async markCreating(job: ClaimedJob): Promise<boolean> {
    // Recorded before the call: a failure after the commit must still count as possibly created.
    this.creating.add(job.leaseToken);
    return super.markCreating(job);
  }

  public forget(job: ClaimedJob): void {
    this.creating.delete(job.leaseToken);
  }
}

/**
 * Wires the creation worker to a sandbox-marked database and runs until aborted.
 * Never logs configuration, tokens, label bytes or driver errors.
 */
export async function runShipmentCreationWorker(
  config: ShipmentCreationConfig,
  signal: AbortSignal,
  setReady: (ready: boolean) => void,
  log: (line: string) => void,
): Promise<void> {
  const guard = {
    nodeEnv: config.nodeEnv,
    sandboxEnabled: true,
    expectedDeploymentId: config.deploymentId,
    testDatabaseUrl: config.databaseUrl,
    productionDatabaseUrl: config.productionDatabaseUrl,
  };
  assertSandboxEnvironment({
    ...guard,
    databaseEnvironment: 'sandbox',
    databaseDeploymentId: config.deploymentId,
  });
  const sql: postgres.Sql<Record<string, unknown>> = postgres(config.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
  });
  try {
    const rows = await sql<
      { environment: string; deployment_id: string; authorized: boolean }[]
    >`SELECT environment, deployment_id::text, pg_catalog.pg_has_role(session_user, 'shipment_creation_worker_role', 'MEMBER') AS authorized FROM sales.shipment_tracking_environment WHERE singleton`;
    const row = rows[0];
    if (!row || !row.authorized) throw new Error('Shipment creation sandbox authorization failed');
    assertSandboxEnvironment({
      ...guard,
      databaseEnvironment: row.environment,
      databaseDeploymentId: row.deployment_id,
    });
    const auth = new FedexAuthAdapter({
      resolve: async (ref): Promise<{ clientId: string; clientSecret: string }> => {
        const credentials = config.credentials[ref];
        if (!credentials) throw new TrackingAuthorizationException();
        return credentials;
      },
    });
    const credentialRefForTenant = (tenantId: string): string | null =>
      config.tenantRefs[tenantId] ?? null;
    const jobs = new TrackingShipmentJobRepository(sql);
    const useCase = new CreateShipmentUseCase(
      jobs,
      new PostgresShipmentCreationSource(sql),
      new PostgresShippingOriginRepository(sql),
      new FedexShipAdapter(auth),
      new SupabaseLabelStorageAdapter(
        createLabelStorageClient(config.labelsSupabaseUrl, config.labelsServiceRoleKey),
      ),
      new PostgresCarrierShipmentRecordAdapter(),
      new PostgresTrackingActivationAdapter(credentialRefForTenant, config.deploymentId),
      new PostgresTransactionManagerAdapter(sql),
      {
        accountNumber: config.accountNumber,
        serviceType: config.serviceType,
        systemActorId: config.systemActorId,
        credentialRefForTenant,
      },
    );
    await runShipmentCreationLoop({
      claim: (): ReturnType<PostgresShipmentJobRepository['claimNext']> =>
        jobs.claimNext(new Date(), config.leaseSeconds),
      execute: async (job): Promise<void> => {
        await useCase.execute(job);
        jobs.forget(job);
      },
      markedCreating: (job): boolean => jobs.wasMarkedCreating(job),
      quarantine: async (job, reason): Promise<void> => {
        await jobs.markNeedsAttention(job, reason);
        jobs.forget(job);
      },
      sleep: async (abortSignal): Promise<void> => {
        try {
          await delay(config.pollIntervalMs, undefined, { signal: abortSignal });
        } catch (error: unknown) {
          if (!abortSignal.aborted) throw error;
        }
      },
      signal,
      setReady,
      log,
    });
  } finally {
    setReady(false);
    await sql.end({ timeout: 5 });
  }
}
