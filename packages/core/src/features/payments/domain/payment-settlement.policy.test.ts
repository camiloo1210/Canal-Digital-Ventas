import { describe, expect, it } from 'vitest';
import {
  assessPaymentSettlement,
  type PaymentSettlementInput,
} from '@/payments/domain/payment-settlement.policy';

const input: PaymentSettlementInput = {
  paymentStatus: 'pending',
  currentProviderOrderId: null,
  providerOrderId: '12',
  paymentOrderId: 'order-1',
  eventOrderId: 'order-1',
  paymentTenantId: 'tenant-1',
  eventTenantId: 'tenant-1',
  amountCents: 1500,
  observedAmountCents: 1500,
  currency: 'USD',
  observedCurrency: 'USD',
  storeId: '2',
  observedStoreId: '2',
  environment: 'test',
  observedEnvironment: 'test',
  providerStatus: 'paid',
  orderPayable: true,
};

describe('financial settlement specification for SQL parity', (): void => {
  it('accepts only a corroborated pending payment for a payable order', (): void => {
    expect(assessPaymentSettlement(input)).toBe('COMPLETED');
  });
  it.each(['completed', 'partially_refunded', 'refunded', 'late_payment_pending_compensation'])(
    'treats the same transaction in %s as idempotent before checking amounts',
    (paymentStatus: string): void => {
      expect(
        assessPaymentSettlement({
          ...input,
          paymentStatus,
          currentProviderOrderId: '12',
          observedAmountCents: 1,
        }),
      ).toBe('ALREADY_PROCESSED');
    },
  );
  it('rejects a second provider transaction on a settled payment', (): void => {
    expect((): string =>
      assessPaymentSettlement({
        ...input,
        paymentStatus: 'completed',
        currentProviderOrderId: '99',
      }),
    ).toThrow();
  });
  it.each([
    { observedAmountCents: 1499 },
    { observedCurrency: 'EUR' },
    { observedStoreId: '3' },
    { observedEnvironment: 'production' },
    { eventTenantId: 'other' },
    { eventOrderId: 'other' },
    { providerStatus: 'pending' },
    { amountCents: 1.5 },
  ])('rejects a financial mismatch %j', (override: Partial<PaymentSettlementInput>): void => {
    expect((): string => assessPaymentSettlement({ ...input, ...override })).toThrow();
  });
  it('routes collection after cancellation to compensation', (): void => {
    expect(assessPaymentSettlement({ ...input, orderPayable: false })).toBe('LATE_PAYMENT');
  });
  it('never revives an expired payment even while the order remains payable', (): void => {
    expect(
      assessPaymentSettlement({
        ...input,
        paymentStatus: 'expired_unpaid_awaiting_reconciliation',
      }),
    ).toBe('LATE_PAYMENT');
  });
});
