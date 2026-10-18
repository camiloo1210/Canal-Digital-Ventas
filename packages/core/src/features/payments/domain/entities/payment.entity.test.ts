import { describe, it, expect } from 'vitest';
import { Payment } from '@/payments/domain/entities/payment.entity';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';
import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { InvalidPaymentStateException } from '@/payments/domain/exceptions/invalid-payment-state.exception';
import { PaymentId } from '@/payments/domain/types/payment-id.type';
import { OrderId } from '@/payments/domain/types/order-id.type';
import { CustomerId } from '@/payments/domain/types/customer-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';

function buildPayment(status: PaymentStatus, rawStatus?: string): Payment {
  return Payment.reconstitute({
    id: 'pay-1' as PaymentId,
    orderId: 'order-1' as OrderId,
    tenantId: 'tenant-1' as TenantId,
    customerId: 'customer-1' as CustomerId,
    status,
    rawStatus,
    gateway: PaymentGateway.LEMON_SQUEEZY,
    amount: Money.from(1500, Currency.USD),
    gatewayTransactionId: null,
    failureReason: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    version: 3,
  });
}

function buildUnknownPayment(rawStatus: string): Payment {
  return buildPayment(PaymentStatus.UNRECOGNIZED, rawStatus);
}

type Mutation = [string, (payment: Payment) => void];

const MUTATIONS: ReadonlyArray<Mutation> = [
  ['markAsCompleted', (payment: Payment): void => payment.markAsCompleted('txn-1')],
  ['markAsFailed', (payment: Payment): void => payment.markAsFailed('declined')],
  ['refund', (payment: Payment): void => payment.refund()],
];

const READ_ONLY_CASES: ReadonlyArray<[string, () => Payment]> = [
  [
    'expired_unpaid_awaiting_reconciliation',
    (): Payment => buildPayment(PaymentStatus.EXPIRED_UNPAID_AWAITING_RECONCILIATION),
  ],
  [
    'late_payment_pending_compensation',
    (): Payment => buildPayment(PaymentStatus.LATE_PAYMENT_PENDING_COMPENSATION),
  ],
  ['partially_refunded', (): Payment => buildPayment(PaymentStatus.PARTIALLY_REFUNDED)],
  ['ATM-59 unknown "weird"', (): Payment => buildUnknownPayment('weird')],
  ['ATM-59 unknown ""', (): Payment => buildUnknownPayment('')],
  ['ATM-59 unknown "COMPLETED"', (): Payment => buildUnknownPayment('COMPLETED')],
];

describe('Payment — legacy transitions (regression)', (): void => {
  it('completes a pending payment', (): void => {
    const payment = buildPayment(PaymentStatus.PENDING);
    expect(payment.isReadOnly()).toBe(false);

    payment.markAsCompleted('txn-1');

    expect(payment.getStatus()).toBe(PaymentStatus.COMPLETED);
    expect(payment.getRawStatus()).toBe('completed');
    expect(payment.getGatewayTransactionId()).toBe('txn-1');
    expect(payment.getVersion()).toBe(4);
    expect(payment.domainEvents).toHaveLength(1);
  });

  it('fails a pending payment', (): void => {
    const payment = buildPayment(PaymentStatus.PENDING);

    payment.markAsFailed('declined');

    expect(payment.getStatus()).toBe(PaymentStatus.FAILED);
    expect(payment.getRawStatus()).toBe('failed');
    expect(payment.getFailureReason()).toBe('declined');
    expect(payment.getVersion()).toBe(4);
  });

  it('refunds a completed payment', (): void => {
    const payment = buildPayment(PaymentStatus.COMPLETED);

    payment.refund();

    expect(payment.getStatus()).toBe(PaymentStatus.REFUNDED);
    expect(payment.getRawStatus()).toBe('refunded');
    expect(payment.getVersion()).toBe(4);
  });

  it('keeps rejecting illegal legacy transitions', (): void => {
    expect((): void => buildPayment(PaymentStatus.COMPLETED).markAsCompleted('txn')).toThrow(
      InvalidPaymentStateException,
    );
    expect((): void => buildPayment(PaymentStatus.FAILED).markAsFailed('x')).toThrow(
      InvalidPaymentStateException,
    );
    expect((): void => buildPayment(PaymentStatus.PENDING).refund()).toThrow(
      InvalidPaymentStateException,
    );
    expect((): void => buildPayment(PaymentStatus.REFUNDED).refund()).toThrow(
      InvalidPaymentStateException,
    );
  });

  it('starts new payments as pending and writable', (): void => {
    const payment = Payment.create(
      'pay-2' as PaymentId,
      'order-2' as OrderId,
      'tenant-1' as TenantId,
      'customer-1' as CustomerId,
      PaymentGateway.MANUAL,
      Money.from(100, Currency.USD),
    );

    expect(payment.getStatus()).toBe(PaymentStatus.PENDING);
    expect(payment.getRawStatus()).toBe('pending');
    expect(payment.isReadOnly()).toBe(false);
  });
});

describe('Payment — read-only states for the legacy domain', (): void => {
  describe.each(READ_ONLY_CASES)('%s', (_label: string, factory: () => Payment): void => {
    it('is read-only', (): void => {
      expect(factory().isReadOnly()).toBe(true);
    });

    it.each(MUTATIONS)(
      '%s throws InvalidPaymentStateException and leaves state untouched',
      (_name: string, mutate: (payment: Payment) => void): void => {
        const payment = factory();
        const statusBefore = payment.getStatus();
        const rawBefore = payment.getRawStatus();

        expect((): void => mutate(payment)).toThrow(InvalidPaymentStateException);
        expect(payment.getStatus()).toBe(statusBefore);
        expect(payment.getRawStatus()).toBe(rawBefore);
        expect(payment.getVersion()).toBe(3);
        expect(payment.domainEvents).toHaveLength(0);
      },
    );
  });
});

describe('Payment.reconstitute — ATM-59 tolerant reader', (): void => {
  it('ATM-59: keeps the raw unknown status and never throws', (): void => {
    const payment = buildUnknownPayment('weird');

    expect(payment.getStatus()).toBe(PaymentStatus.UNRECOGNIZED);
    expect(payment.getRawStatus()).toBe('weird');
  });

  it('ATM-59: downgrades an incoherent status/rawStatus pair to UNRECOGNIZED', (): void => {
    const payment = buildPayment(PaymentStatus.COMPLETED, 'weird');

    expect(payment.getStatus()).toBe(PaymentStatus.UNRECOGNIZED);
    expect(payment.getRawStatus()).toBe('weird');
    expect(payment.isReadOnly()).toBe(true);
  });

  it('ATM-59: resolves a cast-in unknown status to UNRECOGNIZED', (): void => {
    const payment = buildPayment('weird' as PaymentStatus);

    expect(payment.getStatus()).toBe(PaymentStatus.UNRECOGNIZED);
    expect(payment.getRawStatus()).toBe('weird');
  });
});
