import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GeneratePaymentCheckoutUseCase } from '@/payments/application/use-cases/generate-payment-checkout.use-case';
import type { PaymentGatewayFactoryPort } from '@/payments/application/ports/out/payment-gateway-factory.port';
import type { PaymentGatewayPort } from '@/payments/application/ports/out/payment-gateway.port';
import { UnsupportedPaymentGatewayException } from '@/payments/application/exceptions/unsupported-payment-gateway.exception';
import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';
import { InvalidPaymentAttributeException } from '@/payments/domain/exceptions/invalid-payment-attribute.exception';
import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';
import type { Payment } from '@/payments/domain/entities/payment.entity';
import type { PaymentId } from '@/payments/domain/types/payment-id.type';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';
import { InMemoryPaymentRepository } from '@/testing/in-memory/in-memory-payment.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';

const FIXED_PAYMENT_ID = '11111111-1111-4111-8111-111111111111';

vi.mock('crypto', async (importOriginal): Promise<Record<string, unknown>> => {
  const actual = await importOriginal<typeof import('crypto')>();
  return { ...actual, randomUUID: (): string => '11111111-1111-4111-8111-111111111111' };
});

describe('GeneratePaymentCheckoutUseCase', () => {
  let repository: InMemoryPaymentRepository;
  let eventBus: FakeEventBus;
  let createCheckoutSession: ReturnType<typeof vi.fn<(payment: Payment) => Promise<string>>>;
  let getGateway: ReturnType<typeof vi.fn<PaymentGatewayFactoryPort['getGateway']>>;
  let useCase: GeneratePaymentCheckoutUseCase;
  const dto = {
    orderId: 'order-1',
    tenantId: 'tenant-1',
    customerId: 'customer-1',
    gateway: 'lemon_squeezy',
    amount: 15000,
    currency: 'COP',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    repository = new InMemoryPaymentRepository();
    eventBus = new FakeEventBus();
    createCheckoutSession = vi
      .fn<(payment: Payment) => Promise<string>>()
      .mockResolvedValue('https://checkout.example/session-1');
    const gateway: PaymentGatewayPort = {
      createCheckoutSession,
      processWebhook: vi.fn<PaymentGatewayPort['processWebhook']>(),
    };
    getGateway = vi.fn<PaymentGatewayFactoryPort['getGateway']>().mockReturnValue(gateway);
    useCase = new GeneratePaymentCheckoutUseCase(repository, { getGateway }, eventBus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a PENDING payment, returns the gateway url, saves once and publishes PaymentCreatedEvent', async (): Promise<void> => {
    const url = await useCase.execute(dto);

    expect(url).toBe('https://checkout.example/session-1');
    expect(getGateway).toHaveBeenCalledWith(PaymentGateway.LEMON_SQUEEZY);
    const saved = await repository.findById(FIXED_PAYMENT_ID as PaymentId, 'tenant-1' as TenantId);
    expect(saved?.getStatus()).toBe(PaymentStatus.PENDING);
    expect(saved?.getAmount().getValue()).toBe(15000);
    expect(saved?.getOrderId()).toBe('order-1');
    expect(saved?.getCustomerId()).toBe('customer-1');
    expect(repository.saveCount).toBe(1);
    expect(createCheckoutSession).toHaveBeenCalledWith(saved);
    expect(eventBus.publishedLegacy.map((event): string => event.eventName)).toEqual([
      'PaymentCreatedEvent',
    ]);
    expect(saved?.domainEvents).toEqual([]);
  });

  it('keeps tenant isolation: the payment is not visible from another tenant', async (): Promise<void> => {
    await useCase.execute(dto);
    expect(
      await repository.findById(FIXED_PAYMENT_ID as PaymentId, 'tenant-2' as TenantId),
    ).toBeNull();
  });

  it.each([
    ['unknown gateway', { gateway: 'bitcoin' }, InvalidPaymentAttributeException],
    ['unknown currency', { currency: 'XXX' }, InvalidMoneyException],
    ['fractional amount', { amount: 10.5 }, InvalidMoneyException],
    ['negative amount', { amount: -1 }, InvalidMoneyException],
    ['zero amount', { amount: 0 }, InvalidPaymentAttributeException],
    ['empty order id', { orderId: ' ' }, Error],
    ['empty tenant id', { tenantId: '' }, Error],
  ] as const)(
    'rejects %s before calling the gateway and writes nothing',
    async (_label, override, errorClass): Promise<void> => {
      await expect(useCase.execute({ ...dto, ...override })).rejects.toThrow(errorClass);

      expect(createCheckoutSession).not.toHaveBeenCalled();
      expect(repository.saveCount).toBe(0);
      expect(eventBus.publishedLegacy).toEqual([]);
    },
  );

  it('propagates an unsupported gateway and writes nothing', async (): Promise<void> => {
    getGateway.mockImplementation((gateway: PaymentGateway): PaymentGatewayPort => {
      throw new UnsupportedPaymentGatewayException(gateway);
    });

    await expect(useCase.execute(dto)).rejects.toThrow(UnsupportedPaymentGatewayException);

    expect(repository.saveCount).toBe(0);
    expect(eventBus.publishedLegacy).toEqual([]);
  });

  it('does not persist or publish when the gateway fails to create the session', async (): Promise<void> => {
    const failure = new Error('gateway down');
    createCheckoutSession.mockRejectedValue(failure);

    await expect(useCase.execute(dto)).rejects.toBe(failure);

    expect(repository.saveCount).toBe(0);
    expect(eventBus.publishedLegacy).toEqual([]);
  });

  it('does not publish PaymentCreatedEvent when saving fails', async (): Promise<void> => {
    const failure = new Error('database unavailable');
    vi.spyOn(repository, 'save').mockRejectedValue(failure);

    await expect(useCase.execute(dto)).rejects.toBe(failure);

    expect(eventBus.publishedLegacy).toEqual([]);
  });
});
