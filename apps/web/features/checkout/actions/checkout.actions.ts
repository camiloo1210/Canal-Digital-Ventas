'use server';

import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { checkoutDi } from '@/features/checkout/di/checkout.di';
import {
  checkoutFields,
  CheckoutDetailsSchema,
  CartItemsSchema,
  type CheckoutActionState,
  type CheckoutFieldName,
  type CheckoutValues,
} from '@/features/checkout/schemas/checkout.schema';

export type { CheckoutActionState } from '@/features/checkout/schemas/checkout.schema';

export async function submitCheckoutAction(
  tenantSlug: string,
  _prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const t = await getTranslations('Storefront.checkoutErrors');
  const values = Object.fromEntries(
    checkoutFields.map((field): [CheckoutFieldName, string] => {
      const value = formData.get(field.name);
      return [field.name, typeof value === 'string' ? value : ''];
    }),
  ) as CheckoutValues;
  const rejected = (
    errorCode: CheckoutActionState['errorCode'],
    message: string,
    fieldErrors?: CheckoutActionState['fieldErrors'],
  ): CheckoutActionState => ({
    success: false,
    errorCode,
    message,
    values,
    fieldErrors,
    submissionId: crypto.randomUUID(),
  });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return rejected('UNAUTHORIZED', t('unauthorized'));

    const details = CheckoutDetailsSchema.safeParse(values);
    if (!details.success) {
      const fieldErrors: Partial<Record<CheckoutFieldName, string>> = {};
      for (const issue of details.error.issues) {
        const field = checkoutFields.find((candidate): boolean => candidate.name === issue.path[0]);
        if (field)
          fieldErrors[field.name] = t(
            field.name === 'customer.email' ? 'invalidEmail' : 'invalidField',
          );
      }
      return rejected('INVALID_INPUT', t('invalidInput'), fieldErrors);
    }
    const parsedCart = CartItemsSchema.safeParse(formData.get('cartItems'));
    if (!parsedCart.success) return rejected('INVALID_CART', t('invalidCart'));

    const data = details.data;
    const useCase = await checkoutDi.resolveGenerateCommercialOrderUseCase();
    await useCase.execute({
      buyerId: user.id,
      tenantSlug,
      items: parsedCart.data,
      customer: {
        name: data['customer.name'],
        email: data['customer.email'],
        phone: data['customer.phone'],
        documentId: data['customer.documentId'],
      },
      shippingAddress: {
        street: data['shipping.street'],
        city: data['shipping.city'],
        state: data['shipping.state'],
        zipCode: data['shipping.zipCode'],
        country: data['shipping.country'],
        reference: data['shipping.reference'] || undefined,
      },
    });
    return { success: true, errorCode: null };
  } catch (error: unknown) {
    console.error('Checkout error:', error);
    if (error instanceof Error) {
      if (error.name === 'TenantNotAvailableException')
        return rejected('TENANT_NOT_FOUND', t('tenantNotFound'));
      if (error.name === 'ProductOutOfStockException')
        return rejected('OUT_OF_STOCK', t('outOfStock'));
      if (error.name === 'ProductUnavailableException')
        return rejected('PRODUCT_UNAVAILABLE', t('productUnavailable'));
      if (
        error.name === 'InvalidOrderAttributeException' ||
        error.name === 'InvalidQuantityException'
      )
        return rejected('INVALID_CART', t('invalidCart'));
    }
    return rejected('UNEXPECTED', t('unexpected'));
  }
}
