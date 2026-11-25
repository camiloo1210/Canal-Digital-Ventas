'use server';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import {
  OrderNotFoundException,
  ShipmentNotRetryableException,
  ShipmentRetryNotAllowedException,
} from '@canaldigital/packages/core';
import { ordersDi } from '@/features/orders/di/orders.di';
import { resolveOrderManager } from '@/features/orders/server/resolve-order-manager';
import { shipmentJobActionSchema } from '@/features/orders/schemas/shipment-job.schema';

export interface RetryShipmentActionState {
  readonly success: boolean;
  readonly message: string;
}

export async function retryShipmentAction(
  _previous: RetryShipmentActionState,
  formData: FormData,
): Promise<RetryShipmentActionState> {
  const t = await getTranslations('SellerOrders.shipmentJob');
  try {
    const parsed = shipmentJobActionSchema.safeParse({ orderId: formData.get('orderId') });
    if (!parsed.success) return { success: false, message: t('action.invalid') };
    const manager = await resolveOrderManager(formData);
    if (!manager.ok)
      return {
        success: false,
        message: t(
          manager.reason === 'contextChanged' ? 'action.contextChanged' : 'action.unauthorized',
        ),
      };
    await ordersDi.resolveRetryShipmentUseCase().execute({
      orderId: parsed.data.orderId,
      tenantId: manager.tenantId,
      authenticatedSellerId: manager.userId,
    });
    revalidatePath('/dashboard/orders');
    return { success: true, message: t('action.retryQueued') };
  } catch (error: unknown) {
    if (error instanceof OrderNotFoundException)
      return { success: false, message: t('action.orderNotFound') };
    if (error instanceof ShipmentRetryNotAllowedException)
      return { success: false, message: t('action.trackingExists') };
    if (error instanceof ShipmentNotRetryableException)
      return { success: false, message: t('action.notRetryable') };
    return { success: false, message: t('action.failed') };
  }
}
