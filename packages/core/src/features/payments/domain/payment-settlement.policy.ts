import { InvalidPaymentAttributeException } from '@/payments/domain/exceptions/invalid-payment-attribute.exception';
import { InvalidPaymentStateException } from '@/payments/domain/exceptions/invalid-payment-state.exception';

export interface PaymentSettlementInput {
  readonly paymentStatus: string;
  readonly currentProviderOrderId: string | null;
  readonly providerOrderId: string;
  readonly paymentOrderId: string;
  readonly eventOrderId: string;
  readonly paymentTenantId: string;
  readonly eventTenantId: string;
  readonly amountCents: number;
  readonly observedAmountCents: number;
  readonly currency: string;
  readonly observedCurrency: string;
  readonly storeId: string;
  readonly observedStoreId: string;
  readonly environment: string;
  readonly observedEnvironment: string;
  readonly providerStatus: string;
  readonly orderPayable: boolean;
}

export type PaymentSettlementDecision = 'COMPLETED' | 'LATE_PAYMENT' | 'ALREADY_PROCESSED';

/** Executable domain specification mirrored by the fenced settlement RPC (ADR-PAY-001). */
export function assessPaymentSettlement(input: PaymentSettlementInput): PaymentSettlementDecision {
  if (input.providerStatus !== 'paid')
    throw new InvalidPaymentStateException('Provider order is not paid.');
  if (
    ['completed', 'partially_refunded', 'refunded', 'late_payment_pending_compensation'].includes(
      input.paymentStatus,
    )
  ) {
    if (input.currentProviderOrderId !== input.providerOrderId) {
      throw new InvalidPaymentStateException(
        'A different provider order already settled this payment.',
      );
    }
    return 'ALREADY_PROCESSED';
  }
  if (!['pending', 'expired_unpaid_awaiting_reconciliation'].includes(input.paymentStatus)) {
    throw new InvalidPaymentStateException('Payment cannot accept this settlement.');
  }
  if (
    !/^[1-9]\d*$/.test(input.providerOrderId) ||
    !Number.isSafeInteger(input.amountCents) ||
    input.amountCents <= 0 ||
    input.amountCents !== input.observedAmountCents ||
    input.currency !== input.observedCurrency ||
    input.storeId !== input.observedStoreId ||
    !['test', 'production'].includes(input.environment) ||
    input.environment !== input.observedEnvironment ||
    input.paymentOrderId !== input.eventOrderId ||
    input.paymentTenantId !== input.eventTenantId
  ) {
    throw new InvalidPaymentAttributeException('Settlement does not match the authorized payment.');
  }
  return input.paymentStatus === 'pending' && input.orderPayable ? 'COMPLETED' : 'LATE_PAYMENT';
}
