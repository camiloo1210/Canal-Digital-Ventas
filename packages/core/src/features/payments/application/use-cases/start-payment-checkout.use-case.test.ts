import { describe, expect, it } from 'vitest';
import { StartPaymentCheckoutUseCase } from '@/payments/application/use-cases/start-payment-checkout.use-case';
import type {
  CheckoutReservation,
  CheckoutResolution,
  PaymentCheckoutRepositoryPort,
  ReserveCheckout,
} from '@/payments/application/ports/out/payment-checkout-repository.port';
import type {
  CreateProviderCheckout,
  ProviderCheckout,
  ProviderCheckoutPort,
} from '@/payments/application/ports/out/provider-checkout.port';
import { ProviderCheckoutException } from '@/payments/application/exceptions/provider-checkout.exception';

const reservation: CheckoutReservation = {
  outcome: 'CREATED',
  paymentId: 'payment-1',
  orderId: 'order-1',
  tenantId: 'tenant-1',
  amountCents: 1500,
  currency: 'USD',
  storeId: '12',
  environment: 'test',
  expiresAt: '2026-10-16T12:00:00.000Z',
  creationToken: 'token-1',
  checkoutUrl: null,
};

class CheckoutRepository implements PaymentCheckoutRepositoryPort {
  public resolutions: CheckoutResolution[] = [];
  public actor: string | undefined;
  public constructor(public current: CheckoutReservation = reservation) {}
  public async reserve(input: ReserveCheckout): Promise<CheckoutReservation> {
    this.actor = input.authenticatedBuyerId;
    return this.current;
  }
  public async resolve(input: CheckoutResolution): Promise<'PENDING' | 'ALREADY_PAID'> {
    this.resolutions.push(input);
    return 'PENDING';
  }
}

class Gateway implements ProviderCheckoutPort {
  public calls = 0;
  public received: CreateProviderCheckout | undefined;
  public async create(input: CreateProviderCheckout): Promise<ProviderCheckout> {
    this.calls++;
    this.received = input;
    return {
      checkoutId: 'provider-1',
      checkoutUrl: 'https://demo.lemonsqueezy.com/checkout/custom/provider-1',
    };
  }
}

describe('StartPaymentCheckoutUseCase', (): void => {
  it('preserves the paid outcome even when the provider response was ambiguous', async (): Promise<void> => {
    const repo = new CheckoutRepository();
    repo.resolve = async (): Promise<'ALREADY_PAID'> => 'ALREADY_PAID';
    const gateway: ProviderCheckoutPort = {
      create: async (): Promise<ProviderCheckout> => {
        throw new ProviderCheckoutException('AMBIGUOUS', 'TIMEOUT');
      },
    };
    const result = await new StartPaymentCheckoutUseCase(repo, gateway, 'test').execute({
      orderId: 'order-1',
      authenticatedBuyerId: 'buyer-1',
    });
    expect(result).toEqual({ paymentId: 'payment-1', status: 'ALREADY_PAID', checkoutUrl: null });
  });
  it('uses the reserved authority and stores the provider checkout with its fencing token', async (): Promise<void> => {
    const repo = new CheckoutRepository();
    const gateway = new Gateway();
    const result = await new StartPaymentCheckoutUseCase(repo, gateway, 'test').execute({
      orderId: 'order-1',
      authenticatedBuyerId: 'buyer-1',
    });
    expect(repo.actor).toBe('buyer-1');
    expect(gateway.received).toMatchObject({
      amountCents: 1500,
      tenantId: 'tenant-1',
      currency: 'USD',
    });
    expect(repo.resolutions).toEqual([
      {
        paymentId: 'payment-1',
        creationToken: 'token-1',
        mode: 'CREATED',
        checkoutId: 'provider-1',
        checkoutUrl: 'https://demo.lemonsqueezy.com/checkout/custom/provider-1',
        reasonCode: null,
      },
    ]);
    expect(result).toEqual({
      paymentId: 'payment-1',
      status: 'CHECKOUT_READY',
      checkoutUrl: 'https://demo.lemonsqueezy.com/checkout/custom/provider-1',
    });
  });

  it('reuses a persisted checkout without sending another POST', async (): Promise<void> => {
    const repo = new CheckoutRepository({
      ...reservation,
      outcome: 'EXISTING_WITH_CHECKOUT',
      checkoutUrl: 'https://demo.lemonsqueezy.com/checkout/custom/existing',
    });
    const gateway = new Gateway();
    const result = await new StartPaymentCheckoutUseCase(repo, gateway, 'test').execute({
      orderId: 'order-1',
      authenticatedBuyerId: 'buyer-1',
    });
    expect(result.checkoutUrl).toBe('https://demo.lemonsqueezy.com/checkout/custom/existing');
    expect(gateway.calls).toBe(0);
    expect(repo.resolutions).toEqual([]);
  });

  it.each(['BUSY', 'CREATION_UNAVAILABLE'] as const)(
    'does not contact the gateway for %s',
    async (outcome: 'BUSY' | 'CREATION_UNAVAILABLE'): Promise<void> => {
      const repo = new CheckoutRepository({ ...reservation, outcome });
      const gateway = new Gateway();
      await expect(
        new StartPaymentCheckoutUseCase(repo, gateway, 'test').execute({
          orderId: 'order-1',
          authenticatedBuyerId: 'buyer-1',
        }),
      ).rejects.toMatchObject({ code: outcome });
      expect(gateway.calls).toBe(0);
    },
  );

  it('persists timeout exposure without ever creating a second checkout', async (): Promise<void> => {
    const repo = new CheckoutRepository();
    let posts = 0;
    const gateway: ProviderCheckoutPort = {
      create: async (): Promise<ProviderCheckout> => {
        posts++;
        throw new ProviderCheckoutException('AMBIGUOUS', 'TIMEOUT');
      },
    };
    await expect(
      new StartPaymentCheckoutUseCase(repo, gateway, 'test').execute({
        orderId: 'order-1',
        authenticatedBuyerId: 'buyer-1',
      }),
    ).rejects.toMatchObject({ code: 'CREATION_UNAVAILABLE' });
    expect(posts).toBe(1);
    expect(repo.resolutions[0]).toMatchObject({ mode: 'AMBIGUOUS', creationToken: 'token-1' });
  });

  it('does not mark the provider call rejected when persisting its success fails', async (): Promise<void> => {
    const repo = new CheckoutRepository();
    const gateway = new Gateway();
    repo.resolve = async (): Promise<never> => {
      throw new Error('database down');
    };
    await expect(
      new StartPaymentCheckoutUseCase(repo, gateway, 'test').execute({
        orderId: 'order-1',
        authenticatedBuyerId: 'buyer-1',
      }),
    ).rejects.toThrow('database down');
    expect(gateway.calls).toBe(1);
    expect(repo.resolutions).toEqual([]);
  });

  it('returns already paid when the webhook wins the attachment race', async (): Promise<void> => {
    const repo = new CheckoutRepository();
    repo.resolve = async (): Promise<'ALREADY_PAID'> => 'ALREADY_PAID';
    const result = await new StartPaymentCheckoutUseCase(repo, new Gateway(), 'test').execute({
      orderId: 'order-1',
      authenticatedBuyerId: 'buyer-1',
    });
    expect(result).toEqual({ paymentId: 'payment-1', status: 'ALREADY_PAID', checkoutUrl: null });
  });
});
