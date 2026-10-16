import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startPaymentAction } from '@/features/payments/actions/start-payment.actions';

const { getUser, execute, redirect, resolve } = vi.hoisted(
  (): Record<'getUser' | 'execute' | 'redirect' | 'resolve', ReturnType<typeof vi.fn>> => ({
    getUser: vi.fn(),
    execute: vi.fn(),
    redirect: vi.fn(),
    resolve: vi.fn(),
  }),
);
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser } }),
}));
vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('next/navigation', (): object => ({ redirect }));
vi.mock('@/features/payments/di/payments.di', (): object => ({
  paymentsDi: { resolveStartCheckout: resolve },
}));

function form(): FormData {
  const data = new FormData();
  data.set('orderId', '550e8400-e29b-41d4-a716-446655440001');
  data.set('authenticatedBuyerId', 'attacker');
  data.set('amount', '1');
  return data;
}

describe('start payment primary adapter', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'trusted-buyer' } } });
    resolve.mockReturnValue({ execute });
    execute.mockResolvedValue({
      paymentId: 'payment-1',
      status: 'CHECKOUT_READY',
      checkoutUrl: 'https://demo.lemonsqueezy.com/checkout/custom/1',
    });
  });

  it('injects the authenticated buyer and omits client prices and actors', async (): Promise<void> => {
    await startPaymentAction({ errorCode: null, orderId: null }, form());
    expect(execute).toHaveBeenCalledWith({
      orderId: '550e8400-e29b-41d4-a716-446655440001',
      authenticatedBuyerId: 'trusted-buyer',
    });
    expect(redirect).toHaveBeenCalledWith('https://demo.lemonsqueezy.com/checkout/custom/1');
  });

  it('does not catch the Next.js redirect exception as a payment error', async (): Promise<void> => {
    redirect.mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
    await expect(startPaymentAction({ errorCode: null, orderId: null }, form())).rejects.toThrow(
      'NEXT_REDIRECT',
    );
  });

  it('rejects unauthenticated calls before resolving a payment dependency', async (): Promise<void> => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await startPaymentAction({ errorCode: null, orderId: null }, form());
    expect(result.errorCode).toBe('UNAUTHORIZED');
    expect(resolve).not.toHaveBeenCalled();
  });

  it('keeps the order id and masks an unknown infrastructure error', async (): Promise<void> => {
    execute.mockRejectedValue(new Error('postgres://private:secret@host'));
    const result = await startPaymentAction({ errorCode: null, orderId: null }, form());
    expect(result).toMatchObject({
      errorCode: 'UNEXPECTED',
      orderId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(redirect).not.toHaveBeenCalled();
  });
});
