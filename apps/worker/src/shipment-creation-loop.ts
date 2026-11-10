import {
  ShipmentCompletionException,
  type ClaimedJob,
  type ShipmentNeedsAttentionReason,
} from '@canaldigital/packages/core';

export interface ShipmentCreationLoopDeps {
  readonly claim: () => Promise<ClaimedJob | null>;
  readonly execute: (job: ClaimedJob) => Promise<void>;
  readonly sleep: (signal: AbortSignal) => Promise<void>;
  readonly signal: AbortSignal;
  readonly setReady: (ready: boolean) => void;
  readonly log: (line: string) => void;
  /** True once the job may have reached the carrier (its `creating` commit was attempted). */
  readonly markedCreating: (job: ClaimedJob) => boolean;
  /** Takes the job out of the queue so an escaped error cannot re-claim it forever. */
  readonly quarantine: (job: ClaimedJob, reason: ShipmentNeedsAttentionReason) => Promise<void>;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

/** A carrier tracking number is not a secret, but it must stay a single safe log token. */
function safeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/g, '_').slice(0, 120);
}

/**
 * Claims and executes one job at a time. A graceful abort lets the job in flight finish.
 * An error escaping `execute` quarantines that job (needs_attention) and the loop continues;
 * only a failing claim or quarantine stops the worker. Repository exceptions carry raw driver
 * causes, so only the exception class and the order id are logged and rethrown errors have
 * no cause.
 */
export async function runShipmentCreationLoop(deps: ShipmentCreationLoopDeps): Promise<void> {
  let orderId = 'unknown';
  let stage = 'claim';
  deps.setReady(true);
  try {
    while (!deps.signal.aborted) {
      stage = 'claim';
      orderId = 'unknown';
      const job = await deps.claim();
      if (job === null) {
        await deps.sleep(deps.signal);
        continue;
      }
      orderId = job.orderId;
      stage = 'execute';
      try {
        await deps.execute(job);
      } catch (error: unknown) {
        deps.log(`shipment_creation_job_failed error=${errorName(error)} order=${job.orderId}`);
        // Logged before the quarantine write, which may fail too: an operator can always recover
        // the number of a shipment that exists at the carrier instead of creating a duplicate.
        if (error instanceof ShipmentCompletionException)
          deps.log(
            `shipment_creation_provider_tracking order=${job.orderId} tracking=${safeToken(error.providerTrackingNumber)}`,
          );
        stage = 'quarantine';
        await deps.quarantine(
          job,
          deps.markedCreating(job) || job.claimedFrom === 'creating'
            ? 'AMBIGUOUS_RESULT'
            : 'INTERNAL_ERROR',
        );
      }
    }
  } catch (error: unknown) {
    deps.log(`shipment_creation_failed stage=${stage} error=${errorName(error)} order=${orderId}`);
    deps.setReady(false);
    throw new Error('Shipment creation worker loop failed');
  }
  deps.setReady(false);
}
