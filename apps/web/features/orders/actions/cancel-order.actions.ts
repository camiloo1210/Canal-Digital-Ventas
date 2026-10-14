'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { ordersDi } from '@/features/orders/di/orders.di';

export type CancelOrderErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'
  | 'ORDER_NOT_FOUND'
  | 'INVALID_ORDER_STATE'
  | 'CONCURRENCY_ERROR'
  | 'UNEXPECTED';

export interface CancelOrderActionState {
  success: boolean;
  errorCode: CancelOrderErrorCode | null;
  message?: string;
}

const CancelOrderInputSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
});

export async function cancelOrderAction(
  _prevState: CancelOrderActionState,
  formData: FormData,
): Promise<CancelOrderActionState> {
  const t = await getTranslations('Orders.actions');

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: t('unauthorized'),
      };
    }

    const rawOrderId = formData.get('orderId');
    const parseResult = CancelOrderInputSchema.safeParse({ orderId: rawOrderId });

    if (!parseResult.success) {
      return {
        success: false,
        errorCode: 'INVALID_INPUT',
        message: t('invalidInput'),
      };
    }

    const { orderId } = parseResult.data;

    const useCase = ordersDi.resolveCancelOrderUseCase();

    await useCase.execute({
      orderId,
      authenticatedBuyerId: user.id,
    });

    revalidatePath('/');
    revalidatePath('/orders');

    return {
      success: true,
      errorCode: null,
      message: t('cancelSuccess'),
    };
  } catch (error: unknown) {
    console.error('[cancelOrderAction] Error cancelling order:', error);

    if (error instanceof Error) {
      if (error.name === 'OrderNotFoundException') {
        return {
          success: false,
          errorCode: 'ORDER_NOT_FOUND',
          message: t('orderNotFound'),
        };
      }
      if (error.name === 'InvalidOrderStateException') {
        return {
          success: false,
          errorCode: 'INVALID_ORDER_STATE',
          message: t('invalidOrderState'),
        };
      }
      if (error.name === 'OptimisticConcurrencyException') {
        return {
          success: false,
          errorCode: 'CONCURRENCY_ERROR',
          message: t('concurrencyError'),
        };
      }
    }

    return {
      success: false,
      errorCode: 'UNEXPECTED',
      message: t('unexpectedError'),
    };
  }
}
