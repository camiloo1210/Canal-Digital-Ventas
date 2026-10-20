'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import {
  DomainException,
  OrderNotFoundException,
  OptimisticConcurrencyException,
} from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { ordersDi } from '@/features/orders/di/orders.di';
import { changeOrderStatusSchema } from '@/features/orders/schemas/change-order-status.schema';

export interface ChangeOrderStatusActionState {
  readonly success: boolean;
  readonly errorCode:
    | 'UNAUTHORIZED'
    | 'INVALID_INPUT'
    | 'NOT_FOUND'
    | 'CONCURRENCY'
    | 'INVALID_STATE'
    | 'UNEXPECTED'
    | null;
  readonly message?: string;
}

export async function changeOrderStatusAction(
  _previousState: ChangeOrderStatusActionState,
  formData: FormData,
): Promise<ChangeOrderStatusActionState> {
  const t = await getTranslations('SellerOrders');
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return { success: false, errorCode: 'UNAUTHORIZED', message: t('errors.UNAUTHORIZED') };
    const parsed = changeOrderStatusSchema.safeParse({
      orderId: formData.get('orderId'),
      status: formData.get('status'),
      expectedVersion: formData.get('expectedVersion'),
    });
    if (!parsed.success)
      return { success: false, errorCode: 'INVALID_INPUT', message: t('errors.INVALID_INPUT') };
    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId)
      return { success: false, errorCode: 'NOT_FOUND', message: t('errors.NOT_FOUND') };
    await ordersDi.resolveChangeOrderStatusUseCase().execute({
      ...parsed.data,
      tenantId,
      authenticatedSellerId: user.id,
    });
    revalidatePath('/dashboard/orders');
    revalidatePath('/dashboard');
    revalidatePath('/');
    revalidatePath('/purchases');
    return { success: true, errorCode: null, message: t('updated') };
  } catch (error: unknown) {
    const errorCode: NonNullable<ChangeOrderStatusActionState['errorCode']> =
      error instanceof OrderNotFoundException
        ? 'NOT_FOUND'
        : error instanceof OptimisticConcurrencyException
          ? 'CONCURRENCY'
          : error instanceof DomainException
            ? 'INVALID_STATE'
            : 'UNEXPECTED';
    return { success: false, errorCode, message: t(`errors.${errorCode}`) };
  }
}
