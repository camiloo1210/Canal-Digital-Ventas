'use server';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import {
  DomainException,
  InvalidOrderAttributeException,
  OrderNotFoundException,
  OptimisticConcurrencyException,
  UserPermission,
} from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';
import { ordersDi } from '@/features/orders/di/orders.di';
import { registerManualShipmentSchema } from '@/features/orders/schemas/register-manual-shipment.schema';
export interface ManualShipmentActionState {
  readonly success: boolean;
  readonly message: string;
  readonly values: { readonly carrier: string; readonly trackingNumber: string };
}
export async function registerManualShipmentAction(
  _previous: ManualShipmentActionState,
  formData: FormData,
): Promise<ManualShipmentActionState> {
  const t = await getTranslations('SellerOrders');
  const rawCarrier = formData.get('carrier');
  const rawTracking = formData.get('trackingNumber');
  const values = {
    carrier: typeof rawCarrier === 'string' ? rawCarrier : '',
    trackingNumber: typeof rawTracking === 'string' ? rawTracking : '',
  };
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { success: false, message: t('errors.UNAUTHORIZED'), values };
    const parsed = registerManualShipmentSchema.safeParse({
      orderId: formData.get('orderId'),
      version: formData.get('version'),
      ...values,
    });
    if (!parsed.success) return { success: false, message: t('shipment.invalid'), values };
    const tenant = await resolveActionTenant(formData, user.id);
    if (!tenant) return { success: false, message: t('errors.CONTEXT_CHANGED'), values };
    if (!(await userHasAnyPermission(user.id, tenant.tenantId, [UserPermission.MANAGE_ORDERS])))
      return { success: false, message: t('errors.UNAUTHORIZED'), values };
    await ordersDi.resolveRegisterManualShipmentUseCase().execute({
      orderId: parsed.data.orderId,
      tenantId: tenant.tenantId,
      authenticatedSellerId: user.id,
      expectedShipmentVersion: parsed.data.version,
      carrier: parsed.data.carrier,
      trackingNumber: parsed.data.trackingNumber,
    });
    revalidatePath('/dashboard/orders');
    revalidatePath('/purchases');
    return { success: true, message: t('shipment.saved'), values };
  } catch (error: unknown) {
    if (error instanceof InvalidOrderAttributeException)
      return { success: false, message: t('shipment.invalid'), values };
    const code =
      error instanceof OrderNotFoundException
        ? 'NOT_FOUND'
        : error instanceof OptimisticConcurrencyException
          ? 'CONCURRENCY'
          : error instanceof DomainException
            ? 'INVALID_STATE'
            : 'UNEXPECTED';
    return { success: false, message: t(`errors.${code}`), values };
  }
}
