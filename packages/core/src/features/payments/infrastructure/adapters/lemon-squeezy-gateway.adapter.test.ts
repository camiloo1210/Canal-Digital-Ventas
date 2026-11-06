import { afterEach, describe, expect, it, vi } from 'vitest';
import { LemonSqueezyAdapter } from '@/payments/infrastructure/adapters/lemon-squeezy-gateway.adapter';
import { Payment } from '@/payments/domain/entities/payment.entity';
import { createPaymentId } from '@/payments/domain/types/payment-id.type';
import { createOrderId } from '@/payments/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createCustomerId } from '@/payments/domain/types/customer-id.type';
import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';

function payment(currency: Currency): Payment {
  return Payment.create(
    createPaymentId('550e8400-e29b-41d4-a716-446655440000'),
    createOrderId('550e8400-e29b-41d4-a716-446655440001'),
    createTenantId('550e8400-e29b-41d4-a716-446655440002'),
    createCustomerId('550e8400-e29b-41d4-a716-446655440003'),
    PaymentGateway.LEMON_SQUEEZY,
    Money.from(2500, currency),
  );
}

describe('legacy checkout minor units by currency', (): void => {
  afterEach((): void => {
    vi.unstubAllGlobals();
  });
  it.each([
    [Currency.CLP, 5000],
    [Currency.USD, 5000],
  ])('sends %s 5000 minor units as custom_price 5000', async (currency, amount): Promise<void> => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { attributes: { url: 'https://x.lemonsqueezy.com/c' } } }),
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const adapter = new LemonSqueezyAdapter(
      'https://api.lemonsqueezy.com',
      'k',
      's',
      '1',
      '1',
      currency,
    );
    const p = Payment.create(
      createPaymentId('550e8400-e29b-41d4-a716-446655440000'),
      createOrderId('550e8400-e29b-41d4-a716-446655440001'),
      createTenantId('550e8400-e29b-41d4-a716-446655440002'),
      createCustomerId('550e8400-e29b-41d4-a716-446655440003'),
      PaymentGateway.LEMON_SQUEEZY,
      Money.from(amount, currency),
    );
    await adapter.createCheckoutSession(p);
    const init = fetcher.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as {
      data: { attributes: { custom_price: number } };
    };
    expect(body.data.attributes.custom_price).toBe(5000);
  });
});

describe('order_created webhook payload', (): void => {
  it('reports the charged total and currency', async (): Promise<void> => {
    const payload = JSON.stringify({
      meta: {
        event_name: 'order_created',
        webhook_id: 'evt-1',
        custom_data: { payment_id: '550e8400-e29b-41d4-a716-446655440000' },
      },
      data: { id: '9', attributes: { total: 5000, currency: 'clp' } },
    });
    const sig = (await import('crypto')).createHmac('sha256', 's').update(payload).digest('hex');
    const adapter = new LemonSqueezyAdapter('u', 'k', 's', '1', '1', Currency.CLP);
    const result = await adapter.processWebhook(payload, sig);
    expect(result).toMatchObject({ paidAmount: 5000, paidCurrency: 'CLP' });
  });
});

describe('legacy checkout monetary scale', (): void => {
  afterEach((): void => {
    vi.unstubAllGlobals();
  });

  it('sends minor units once without multiplying cents by 100', async (): Promise<void> => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { attributes: { url: 'https://example.lemonsqueezy.com/checkout/test' } },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    const adapter = new LemonSqueezyAdapter(
      'https://api.lemonsqueezy.com',
      'key',
      'secret',
      '1',
      '1',
      Currency.USD,
    );
    await adapter.createCheckoutSession(payment(Currency.USD));
    const init = fetcher.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as {
      data: { attributes: { custom_price: number } };
    };
    expect(body.data.attributes.custom_price).toBe(2500);
  });

  it('rejects a mismatched store currency before contacting the provider', async (): Promise<void> => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const adapter = new LemonSqueezyAdapter(
      'https://api.lemonsqueezy.com',
      'key',
      'secret',
      '1',
      '1',
      Currency.USD,
    );
    await expect(adapter.createCheckoutSession(payment(Currency.EUR))).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
