import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

/** Reasons that need a seller decision before the job may run again. */
export type ShipmentNeedsAttentionReason =
  | 'MISSING_PACKAGE_DATA'
  | 'INVALID_PACKAGE_DATA'
  | 'MISSING_ORIGIN'
  | 'MISSING_CREDENTIALS'
  | 'AMBIGUOUS_RESULT'
  | 'INTERNAL_ERROR'
  /** The order already has a tracking number: no carrier shipment is created and none is retried. */
  | 'SHIPMENT_ALREADY_RECORDED';

/** Reason kept on a `done` job whose carrier label could not be stored (shipment exists). */
export const LABEL_UNAVAILABLE_REASON = 'LABEL_UNAVAILABLE';

export interface ClaimedJob {
  readonly tenantId: string;
  readonly orderId: string;
  readonly leaseToken: string;
  readonly leaseSeconds: number;
  readonly attempts: number;
  /** State the job was in when claimed; `creating` means a previous worker died mid-call. */
  readonly claimedFrom: 'queued' | 'creating';
}

export interface ShipmentJobRepositoryPort {
  /** Leases the next queued job, or a `creating` job whose lease expired (crashed worker). */
  claimNext(now: Date, leaseSeconds: number): Promise<ClaimedJob | null>;
  /** Commits `creating` (own transaction) before the carrier call; false when the lease was lost. */
  markCreating(job: ClaimedJob): Promise<boolean>;
  /**
   * Marks the job done inside the caller's success transaction. A null label path keeps
   * reason `LABEL_UNAVAILABLE` so the seller sees the shipment exists without a label.
   */
  complete(job: ClaimedJob, labelPath: string | null, tx: TransactionContext): Promise<void>;
  /**
   * `providerTrackingNumber` is kept when the carrier already created the shipment, which
   * permanently blocks `retry` so a second carrier shipment can never be created.
   */
  markNeedsAttention(
    job: ClaimedJob,
    reason: ShipmentNeedsAttentionReason,
    providerTrackingNumber?: string,
  ): Promise<void>;
  markFailed(job: ClaimedJob, reason: string): Promise<void>;
  /**
   * Persists the carrier tracking number right after the carrier created the shipment,
   * independently of the lease (a lost lease must never lose it). The first number wins and a
   * `done` job is never touched. Like `markNeedsAttention`, a stored number blocks `retry`.
   */
  recordProviderTrackingNumber(job: ClaimedJob, trackingNumber: string): Promise<void>;
  /**
   * Seller retry; only from `needs_attention`/`failed` and only for a manager of the tenant.
   * Throws `ShipmentRetryNotAllowedException` when the carrier already returned a tracking number.
   */
  retry(tenantId: string, orderId: string, actorId: string): Promise<boolean>;
}
