'use server';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { UserPermission } from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';
import { ordersDi } from '@/features/orders/di/orders.di';
import { enableTrackingSchema } from '@/features/orders/schemas/enable-tracking.schema';
export interface EnableTrackingActionState {
  readonly success: boolean;
  readonly message: string;
}
async function changeTracking(
  formData: FormData,
  operation: 'enable' | 'disable',
): Promise<EnableTrackingActionState> {
  const t = await getTranslations('ShipmentTracking');
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { success: false, message: t('action.unauthorized') };
    const parsed = enableTrackingSchema.safeParse({
      orderId: formData.get('orderId'),
      version: formData.get('version'),
    });
    if (!parsed.success) return { success: false, message: t('action.invalid') };
    const tenant = await resolveActionTenant(formData, user.id);
    if (
      !tenant ||
      !(await userHasAnyPermission(user.id, tenant.tenantId, [UserPermission.MANAGE_ORDERS]))
    )
      return { success: false, message: t('action.unauthorized') };
    const base = {
      tenantId: tenant.tenantId,
      orderId: parsed.data.orderId,
      authenticatedSellerId: user.id,
      expectedShipmentVersion: parsed.data.version,
    };
    if (operation === 'enable') {
      const useCase = ordersDi.resolveEnableTrackingUseCase();
      if (!useCase) return { success: false, message: t('action.unavailable') };
      await useCase.execute({ ...base, provider: 'fedex' });
    } else {
      const useCase = ordersDi.resolveDisableTrackingUseCase();
      if (!useCase) return { success: false, message: t('action.unavailable') };
      await useCase.execute(base);
    }
    revalidatePath('/dashboard/orders');
    revalidatePath('/purchases');
    return {
      success: true,
      message: t(operation === 'enable' ? 'action.enabled' : 'action.disabled'),
    };
  } catch {
    return { success: false, message: t('action.failed') };
  }
}

export async function enableTrackingAction(
  _previous: EnableTrackingActionState,
  formData: FormData,
): Promise<EnableTrackingActionState> {
  return changeTracking(formData, 'enable');
}
export async function disableTrackingAction(
  _previous: EnableTrackingActionState,
  formData: FormData,
): Promise<EnableTrackingActionState> {
  return changeTracking(formData, 'disable');
}
