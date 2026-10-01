'use server';

import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { checkoutDi } from '@/features/checkout/di/checkout.di';

type CheckoutErrorCode =
  | 'OUT_OF_STOCK'
  | 'PRODUCT_UNAVAILABLE'
  | 'INVALID_CART'
  | 'UNAUTHORIZED'
  | 'TENANT_NOT_FOUND'
  | 'UNEXPECTED';

export interface CheckoutActionState {
  success: boolean;
  errorCode: CheckoutErrorCode | null;
  errorParams?: Record<string, string | number>;
  message?: string; // Translated message for presentation
}

const CustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  documentId: z.string().min(1),
});

const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  country: z.string().min(1),
  reference: z.string().optional(),
});

const CartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(9999),
});

const CartItemsSchema = z
  .string()
  .transform((str, ctx) => {
    try {
      return JSON.parse(str);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid JSON payload' });
      return z.NEVER;
    }
  })
  .pipe(z.array(CartItemSchema).min(1).max(100))
  .refine(
    (items) => {
      const ids = items.map((i) => i.productId);
      return new Set(ids).size === ids.length;
    },
    { message: 'Duplicate products are not allowed in the payload' },
  );

export async function submitCheckoutAction(
  tenantSlug: string,
  prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const t = await getTranslations('Storefront.checkoutErrors');

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, errorCode: 'UNAUTHORIZED', message: t('unauthorized') };
    }

        const customerData = {
      name: formData.get('customer.name'),
      email: formData.get('customer.email'),
      phone: formData.get('customer.phone'),
      documentId: formData.get('customer.documentId'),
    };
    const addressData = {
      street: formData.get('shipping.street'),
      city: formData.get('shipping.city'),
      state: formData.get('shipping.state'),
      zipCode: formData.get('shipping.zipCode'),
      country: formData.get('shipping.country'),
      reference: formData.get('shipping.reference') || undefined,
    };

    const parsedCustomer = CustomerSchema.safeParse(customerData);
    const parsedAddress = AddressSchema.safeParse(addressData);

    if (!parsedCustomer.success || !parsedAddress.success) {
      return { success: false, errorCode: 'INVALID_CART', message: t('invalidCart') }; // Could be INVALID_FORM
    }

    const cartData = formData.get('cartItems');
    if (!cartData || typeof cartData !== 'string') {
      return { success: false, errorCode: 'INVALID_CART', message: t('invalidCart') };
    }

    const parseResult = CartItemsSchema.safeParse(cartData);
    if (!parseResult.success) {
      return { success: false, errorCode: 'INVALID_CART', message: t('invalidCart') };
    }

    const items = parseResult.data;

    const useCase = await checkoutDi.resolveGenerateCommercialOrderUseCase();

    await useCase.execute({
      buyerId: user.id,
      tenantSlug: tenantSlug,
      items: items,
      customer: parsedCustomer.data,
      shippingAddress: parsedAddress.data,
    });

    return { success: true, errorCode: null };
  } catch (error: unknown) {
    console.error('Checkout error:', error);
    if (error instanceof Error) {
      if (error.name === 'TenantNotAvailableException') {
        return { success: false, errorCode: 'TENANT_NOT_FOUND', message: t('tenantNotFound') };
      }
      if (error.name === 'ProductOutOfStockException') {
        return { success: false, errorCode: 'OUT_OF_STOCK', message: t('outOfStock') };
      }
      if (error.name === 'ProductUnavailableException') {
        return {
          success: false,
          errorCode: 'PRODUCT_UNAVAILABLE',
          message: t('productUnavailable'),
        };
      }
      if (
        error.name === 'InvalidOrderAttributeException' ||
        error.name === 'InvalidQuantityException'
      ) {
        return { success: false, errorCode: 'INVALID_CART', message: t('invalidCart') };
      }
    }

    return { success: false, errorCode: 'UNEXPECTED', message: t('unexpected') };
  }
}
