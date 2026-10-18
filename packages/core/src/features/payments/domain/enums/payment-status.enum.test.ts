import { describe, it, expect } from 'vitest';
import {
  PaymentStatus,
  isLegacyWritablePaymentStatus,
  resolvePaymentStatus,
} from '@/payments/domain/enums/payment-status.enum';

const LEGACY_STATUSES: ReadonlyArray<[string, PaymentStatus]> = [
  ['pending', PaymentStatus.PENDING],
  ['completed', PaymentStatus.COMPLETED],
  ['failed', PaymentStatus.FAILED],
  ['refunded', PaymentStatus.REFUNDED],
];

const NEW_STATUSES: ReadonlyArray<[string, PaymentStatus]> = [
  ['expired_unpaid_awaiting_reconciliation', PaymentStatus.EXPIRED_UNPAID_AWAITING_RECONCILIATION],
  ['late_payment_pending_compensation', PaymentStatus.LATE_PAYMENT_PENDING_COMPENSATION],
  ['partially_refunded', PaymentStatus.PARTIALLY_REFUNDED],
];

const UNKNOWN_RAW_STATUSES: ReadonlyArray<unknown> = [
  '',
  'weird',
  'COMPLETED',
  ' completed',
  '__unrecognized__',
  null,
  undefined,
  42,
];

describe('resolvePaymentStatus', (): void => {
  it.each(LEGACY_STATUSES)(
    'recognizes legacy status "%s" with unchanged meaning',
    (raw: string, expected: PaymentStatus): void => {
      expect(resolvePaymentStatus(raw)).toBe(expected);
      expect(isLegacyWritablePaymentStatus(expected)).toBe(true);
    },
  );

  it.each(NEW_STATUSES)(
    'recognizes new status "%s" as read-only for the legacy domain',
    (raw: string, expected: PaymentStatus): void => {
      expect(resolvePaymentStatus(raw)).toBe(expected);
      expect(isLegacyWritablePaymentStatus(expected)).toBe(false);
    },
  );

  it.each(UNKNOWN_RAW_STATUSES)(
    'ATM-59: resolves unknown raw status %j to UNRECOGNIZED without throwing',
    (raw: unknown): void => {
      expect((): PaymentStatus => resolvePaymentStatus(raw)).not.toThrow();
      expect(resolvePaymentStatus(raw)).toBe(PaymentStatus.UNRECOGNIZED);
    },
  );

  it('ATM-59: UNRECOGNIZED is never legacy-writable', (): void => {
    expect(isLegacyWritablePaymentStatus(PaymentStatus.UNRECOGNIZED)).toBe(false);
  });
});
