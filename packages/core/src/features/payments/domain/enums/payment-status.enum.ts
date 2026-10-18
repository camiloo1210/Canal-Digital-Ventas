export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  EXPIRED_UNPAID_AWAITING_RECONCILIATION = 'expired_unpaid_awaiting_reconciliation',
  LATE_PAYMENT_PENDING_COMPENSATION = 'late_payment_pending_compensation',
  PARTIALLY_REFUNDED = 'partially_refunded',
  // Read sentinel: this value must never be persisted.
  UNRECOGNIZED = '__unrecognized__',
}

const RECOGNIZED_PAYMENT_STATUSES: ReadonlySet<string> = new Set<string>([
  PaymentStatus.PENDING,
  PaymentStatus.COMPLETED,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
  PaymentStatus.EXPIRED_UNPAID_AWAITING_RECONCILIATION,
  PaymentStatus.LATE_PAYMENT_PENDING_COMPENSATION,
  PaymentStatus.PARTIALLY_REFUNDED,
]);

const LEGACY_WRITABLE_PAYMENT_STATUSES: ReadonlySet<PaymentStatus> = new Set<PaymentStatus>([
  PaymentStatus.PENDING,
  PaymentStatus.COMPLETED,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
]);

// Tolerant reader (plan §5.4): a total function that never throws.
export function resolvePaymentStatus(raw: unknown): PaymentStatus {
  if (typeof raw === 'string' && RECOGNIZED_PAYMENT_STATUSES.has(raw)) {
    return raw as PaymentStatus;
  }
  return PaymentStatus.UNRECOGNIZED;
}

export function isLegacyWritablePaymentStatus(status: PaymentStatus): boolean {
  return LEGACY_WRITABLE_PAYMENT_STATUSES.has(status);
}
