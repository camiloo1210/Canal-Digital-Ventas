'use server';

import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveTenantQuery } from '@/features/iam/queries/resolve-tenant.query';
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

    const tenantContext = await resolveTenantQuery(tenantSlug);
    if (!tenantContext) {
      return { success: false, errorCode: 'TENANT_NOT_FOUND', message: t('tenantNotFound') };
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


    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();

    if (tenantError || !tenantData) {
      return { success: false, errorCode: 'TENANT_NOT_FOUND', message: t('tenantNotFound') };
    }

    const tenantId = tenantData.id;

    await useCase.execute({
      buyerId: user.id,
      tenantId: tenantId,
      items: items,
    });

    return { success: true, errorCode: null };
  } catch (error: unknown) {
    if (error instanceof Error) {
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
