'use server';

import { revalidatePath } from 'next/cache';
import { invalidateTenantCatalog } from '@/features/store/utils/catalog-invalidation';
import { getTranslations } from 'next-intl/server';
import {
  UserPermission,
  DomainException,
  OrderNotFoundException,
  OptimisticConcurrencyException,
} from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';
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
    | 'CONTEXT_CHANGED'
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
    const tenant = await resolveActionTenant(formData, user.id);
    if (!tenant)
      return {
        success: false,
        errorCode: 'CONTEXT_CHANGED',
        message: t('errors.CONTEXT_CHANGED'),
      };
    const tenantId = tenant.tenantId;
    if (!(await userHasAnyPermission(user.id, tenantId, [UserPermission.MANAGE_ORDERS])))
      return { success: false, errorCode: 'UNAUTHORIZED', message: t('errors.UNAUTHORIZED') };
    await ordersDi.resolveChangeOrderStatusUseCase().execute({
      ...parsed.data,
      tenantId,
      authenticatedSellerId: user.id,
    });
    await invalidateTenantCatalog(tenant.tenantSlug);
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
