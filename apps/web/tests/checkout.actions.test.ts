import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitCheckoutAction } from '@/features/checkout/actions/checkout.actions';
import { checkoutFields } from '@/features/checkout/schemas/checkout.schema';
import { createClient } from '@/lib/supabase/server';
import { cartDi } from '@/features/cart/di/cart.di';
import { checkoutDi } from '@/features/checkout/di/checkout.di';
import { invalidatePublicCatalog } from '@/lib/cache/public-catalog-cache';

vi.mock('next-intl/server', (): object => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));
vi.mock('@/lib/supabase/server', (): object => ({ createClient: vi.fn() }));
vi.mock('@/features/checkout/di/checkout.di', (): object => ({
  checkoutDi: { resolveGenerateCommercialOrderUseCase: vi.fn() },
}));
vi.mock('@/features/cart/di/cart.di', (): object => ({
  cartDi: { resolveActiveTenantId: vi.fn(), resolveCompleteBuyerCartUseCase: vi.fn() },
}));
vi.mock('@/lib/cache/public-catalog-cache', (): object => ({
  invalidatePublicCatalog: vi.fn(),
}));
const execute = vi.fn();
const completeCart = vi.fn();
const tenantId = crypto.randomUUID();
const buyerId = crypto.randomUUID();
const productId = crypto.randomUUID();
function form(): FormData {
  const data = new FormData();
  for (const field of checkoutFields) data.set(field.name, 'Kept value');
  data.set('customer.email', 'buyer@example.test');
  data.set('cartItems', JSON.stringify([{ productId, quantity: 2 }]));
  return data;
}
describe('checkout adapter validation and retention', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    execute.mockReset().mockResolvedValue(undefined);
    completeCart.mockReset().mockResolvedValue(undefined);
    vi.mocked(cartDi.resolveActiveTenantId).mockResolvedValue(tenantId);
    vi.mocked(cartDi.resolveCompleteBuyerCartUseCase).mockReturnValue({
      execute: completeCart,
    } as unknown as ReturnType<typeof cartDi.resolveCompleteBuyerCartUseCase>);
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: buyerId } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(checkoutDi.resolveGenerateCommercialOrderUseCase).mockResolvedValue({
      execute,
    } as unknown as Awaited<ReturnType<typeof checkoutDi.resolveGenerateCommercialOrderUseCase>>);
  });
  it('returns localized field errors and all submitted values before touching the use case', async (): Promise<void> => {
    const data = form();
    data.set('customer.name', '   ');
    data.set('customer.email', 'invalid');
    const result = await submitCheckoutAction('store', { success: false, errorCode: null }, data);
    expect(result.errorCode).toBe('INVALID_INPUT');
    expect(result.fieldErrors).toMatchObject({
      'customer.name': 'invalidField',
      'customer.email': 'invalidEmail',
    });
    expect(result.values?.['customer.name']).toBe('   ');
    expect(result.values?.['shipping.street']).toBe('Kept value');
    expect(result.submissionId).toBeTruthy();
    expect(execute).not.toHaveBeenCalled();
  });
  it('retains values on invalid cart and rejects duplicates', async (): Promise<void> => {
    const data = form();
    data.set(
      'cartItems',
      JSON.stringify([
        { productId, quantity: 1 },
        { productId, quantity: 1 },
      ]),
    );
    const result = await submitCheckoutAction('store', { success: false, errorCode: null }, data);
    expect(result.errorCode).toBe('INVALID_CART');
    expect(result.values?.['customer.email']).toBe('buyer@example.test');
    expect(execute).not.toHaveBeenCalled();
  });
  it('retains values when the session expires', async (): Promise<void> => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await submitCheckoutAction('store', { success: false, errorCode: null }, form());
    expect(result.errorCode).toBe('UNAUTHORIZED');
    expect(result.values?.['shipping.city']).toBe('Kept value');
    expect(execute).not.toHaveBeenCalled();
  });
  it('retains values and masks unexpected failures', async (): Promise<void> => {
    execute.mockRejectedValue(new Error('private provider details'));
    const result = await submitCheckoutAction('store', { success: false, errorCode: null }, form());
    expect(result.errorCode).toBe('UNEXPECTED');
    expect(result.message).toBe('unexpected');
    expect(result.values?.['shipping.country']).toBe('Kept value');
  });
  it('rejects an unsupported monetary total without losing the checkout fields', async (): Promise<void> => {
    const failure = new Error('Monetary limit exceeded');
    failure.name = 'InvalidMoneyException';
    execute.mockRejectedValue(failure);
    const result = await submitCheckoutAction('store', { success: false, errorCode: null }, form());
    expect(result.errorCode).toBe('INVALID_CART');
    expect(result.values?.['shipping.city']).toBe('Kept value');
    expect(completeCart).not.toHaveBeenCalled();
  });
  it('injects the authenticated buyer and submits only the allowed DTO fields', async (): Promise<void> => {
    const data = form();
    data.set('buyerId', 'attacker');
    data.set('tenantId', 'other-store');
    const result = await submitCheckoutAction('store', { success: false, errorCode: null }, data);
    expect(result.success).toBe(true);
    expect(result.values).toBeUndefined();
    expect(invalidatePublicCatalog).toHaveBeenCalledWith('store');
    expect(execute).toHaveBeenCalledWith({
      buyerId,
      tenantSlug: 'store',
      items: [{ productId, quantity: 2 }],
      customer: {
        name: 'Kept value',
        email: 'buyer@example.test',
        phone: 'Kept value',
        documentId: 'Kept value',
      },
      shippingAddress: {
        street: 'Kept value',
        city: 'Kept value',
        state: 'Kept value',
        zipCode: 'Kept value',
        country: 'Kept value',
        reference: 'Kept value',
      },
    });
  });
  it('completes the server cart with the session user and resolved tenant after the order', async (): Promise<void> => {
    const data = form();
    data.set('userId', 'attacker');
    const result = await submitCheckoutAction('store', { success: false, errorCode: null }, data);
    expect(result.success).toBe(true);
    expect(cartDi.resolveActiveTenantId).toHaveBeenCalledWith('store');
    expect(completeCart).toHaveBeenCalledWith({ userId: buyerId, tenantId });
  });
  it('never fails the order when completing the cart throws', async (): Promise<void> => {
    completeCart.mockRejectedValue(new Error('cart db down'));
    const result = await submitCheckoutAction('store', { success: false, errorCode: null }, form());
    expect(result.success).toBe(true);
    vi.mocked(cartDi.resolveActiveTenantId).mockRejectedValue(new Error('tenant lookup down'));
    const again = await submitCheckoutAction('store', { success: false, errorCode: null }, form());
    expect(again.success).toBe(true);
  });
  it('does not touch the cart when the order fails', async (): Promise<void> => {
    execute.mockRejectedValue(new Error('boom'));
    await submitCheckoutAction('store', { success: false, errorCode: null }, form());
    expect(completeCart).not.toHaveBeenCalled();
  });
});
