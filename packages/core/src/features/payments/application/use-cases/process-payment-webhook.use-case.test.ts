import { describe, expect, it, vi } from 'vitest';
import { ProcessPaymentWebhookUseCase } from '@/payments/application/use-cases/process-payment-webhook.use-case';
import type { PaymentRepositoryPort } from '@/payments/application/ports/out/payment-repository.port';
import type { PaymentGatewayFactoryPort } from '@/payments/application/ports/out/payment-gateway-factory.port';
import type { WebhookResult } from '@/payments/application/ports/out/payment-gateway.port';
import type { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { Payment } from '@/payments/domain/entities/payment.entity';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';
import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { createPaymentId } from '@/payments/domain/types/payment-id.type';
import { createOrderId } from '@/payments/domain/types/order-id.type';
import { createCustomerId } from '@/payments/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';

const PAYMENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440002';

function setup(result: Partial<WebhookResult>): {
  useCase: ProcessPaymentWebhookUseCase;
  payment: Payment;
  save: ReturnType<typeof vi.fn>;
} {
  const payment = Payment.create(
    createPaymentId(PAYMENT_ID),
    createOrderId('550e8400-e29b-41d4-a716-446655440001'),
    createTenantId(TENANT_ID),
    createCustomerId('550e8400-e29b-41d4-a716-446655440003'),
    PaymentGateway.LEMON_SQUEEZY,
    Money.from(5000, Currency.CLP),
  );
  const save = vi.fn().mockResolvedValue(undefined);
  const repository = {
    findById: vi.fn().mockResolvedValue(payment),
    save,
  } as unknown as PaymentRepositoryPort;
  const factory: PaymentGatewayFactoryPort = {
    getGateway: (): {
      createCheckoutSession: () => Promise<string>;
      processWebhook: () => Promise<WebhookResult>;
    } => ({
      createCheckoutSession: (): Promise<string> => Promise.resolve('url'),
      processWebhook: (): Promise<WebhookResult> =>
        Promise.resolve({
          eventId: 'evt-1',
          paymentId: createPaymentId(PAYMENT_ID),
          status: PaymentStatus.COMPLETED,
          ...result,
        }),
    }),
  };
  const eventBus = { publish: vi.fn().mockResolvedValue(undefined) } as unknown as EventBusPort;
  return {
    useCase: new ProcessPaymentWebhookUseCase(repository, factory, eventBus),
    payment,
    save,
  };
}

const dto = {
  gateway: PaymentGateway.LEMON_SQUEEZY,
  tenantId: TENANT_ID,
  payload: '{}',
  signature: 's',
};

describe('payment webhook amount verification', (): void => {
  it('completes when amount and currency match', async (): Promise<void> => {
    const { useCase, payment, save } = setup({ paidAmount: 5000, paidCurrency: 'CLP' });
    await useCase.execute(dto);
    expect(payment.getStatus()).toBe(PaymentStatus.COMPLETED);
    expect(save).toHaveBeenCalled();
  });
  it('refuses an amount mismatch', async (): Promise<void> => {
    const { useCase, payment, save } = setup({ paidAmount: 50, paidCurrency: 'CLP' });
    await expect(useCase.execute(dto)).rejects.toThrow(/does not match/);
    expect(payment.getStatus()).toBe(PaymentStatus.PENDING);
    expect(save).not.toHaveBeenCalled();
  });
  it('refuses a currency mismatch', async (): Promise<void> => {
    const { useCase, save } = setup({ paidAmount: 5000, paidCurrency: 'USD' });
    await expect(useCase.execute(dto)).rejects.toThrow(/does not match/);
    expect(save).not.toHaveBeenCalled();
  });
});
