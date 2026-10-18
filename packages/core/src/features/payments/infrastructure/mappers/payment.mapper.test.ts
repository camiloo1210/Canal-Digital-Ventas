import { describe, it, expect } from 'vitest';
import { PaymentMapper } from '@/payments/infrastructure/mappers/payment.mapper';
import { Payment } from '@/payments/domain/entities/payment.entity';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';
import { InvalidPaymentStateException } from '@/payments/domain/exceptions/invalid-payment-state.exception';
import { UnpersistablePaymentStatusException } from '@/payments/domain/exceptions/unpersistable-payment-status.exception';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';
import { DbPaymentRow } from '@/payments/infrastructure/types/supabase-payment.types';

function buildRow(status: string): DbPaymentRow {
  return {
    id: 'pay-1',
    order_id: 'order-1',
    tenant_id: 'tenant-1',
    customer_id: 'customer-1',
    status,
    gateway: 'lemon_squeezy',
    amount_cents: 1500,
    gateway_transaction_id: 'txn-1',
    failure_reason: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:00.000Z',
    version: 7,
  };
}

const LEGACY_STATUSES: ReadonlyArray<string> = ['pending', 'completed', 'failed', 'refunded'];

const NEW_STATUSES: ReadonlyArray<string> = [
  'expired_unpaid_awaiting_reconciliation',
  'late_payment_pending_compensation',
  'partially_refunded',
];

const UNKNOWN_STATUSES: ReadonlyArray<string> = ['', 'weird', 'COMPLETED', '__unrecognized__'];

describe('PaymentMapper', (): void => {
  it.each(LEGACY_STATUSES)('round-trips legacy status "%s" unchanged', (status: string): void => {
    const row = buildRow(status);

    const payment = PaymentMapper.toDomain(row);

    expect(payment.getStatus()).toBe(status);
    expect(payment.getRawStatus()).toBe(status);
    expect(payment.isReadOnly()).toBe(false);
    expect(PaymentMapper.toPersistence(payment)).toEqual(row);
  });

  it.each(NEW_STATUSES)(
    'reads new status "%s" as recognized and read-only',
    (status: string): void => {
      const payment = PaymentMapper.toDomain(buildRow(status));

      expect(payment.getStatus()).toBe(status);
      expect(payment.getRawStatus()).toBe(status);
      expect(payment.isReadOnly()).toBe(true);
      expect((): void => payment.refund()).toThrow(InvalidPaymentStateException);
      expect((): DbPaymentRow => PaymentMapper.toPersistence(payment)).toThrow(
        UnpersistablePaymentStatusException,
      );
    },
  );

  it.each(UNKNOWN_STATUSES)(
    'ATM-59: toDomain reads unknown status %j without throwing and keeps rawStatus',
    (status: string): void => {
      const row = buildRow(status);

      expect((): Payment => PaymentMapper.toDomain(row)).not.toThrow();
      const payment = PaymentMapper.toDomain(row);

      expect(payment.getStatus()).toBe(PaymentStatus.UNRECOGNIZED);
      expect(payment.getRawStatus()).toBe(status);
      expect(payment.isReadOnly()).toBe(true);
    },
  );

  it.each(UNKNOWN_STATUSES)(
    'ATM-59: toPersistence refuses to write a payment with unknown status %j',
    (status: string): void => {
      const payment = PaymentMapper.toDomain(buildRow(status));

      expect((): DbPaymentRow => PaymentMapper.toPersistence(payment)).toThrow(
        UnpersistablePaymentStatusException,
      );
      expect((): DbPaymentRow => PaymentMapper.toPersistence(payment)).toThrow(DomainException);
    },
  );

  it('persists a legacy transition performed after reading (regression)', (): void => {
    const payment = PaymentMapper.toDomain(buildRow('completed'));

    payment.refund();
    const persisted = PaymentMapper.toPersistence(payment);

    expect(persisted.status).toBe('refunded');
    expect(persisted.version).toBe(8);
    expect(persisted.amount_cents).toBe(1500);
  });
});
