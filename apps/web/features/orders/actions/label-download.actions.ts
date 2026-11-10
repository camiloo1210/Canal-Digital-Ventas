'use server';
import { getTranslations } from 'next-intl/server';
import {
  OrderNotFoundException,
  ShipmentLabelUnavailableException,
} from '@canaldigital/packages/core';
import { ordersDi } from '@/features/orders/di/orders.di';
import { resolveOrderManager } from '@/features/orders/server/resolve-order-manager';
import { shipmentJobActionSchema } from '@/features/orders/schemas/shipment-job.schema';

export interface LabelDownloadActionState {
  readonly success: boolean;
  readonly message: string;
  /** Short-lived (60 s) signed link; the storage path itself is never returned. */
  readonly url?: string;
}

export async function downloadLabelAction(
  _previous: LabelDownloadActionState,
  formData: FormData,
): Promise<LabelDownloadActionState> {
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
    const useCase = await ordersDi.resolveGetLabelUrlUseCase();
    const url = await useCase.execute({
      orderId: parsed.data.orderId,
      tenantId: manager.tenantId,
      authenticatedSellerId: manager.userId,
    });
    return { success: true, url, message: '' };
  } catch (error: unknown) {
    if (error instanceof OrderNotFoundException)
      return { success: false, message: t('action.orderNotFound') };
    if (error instanceof ShipmentLabelUnavailableException)
      return { success: false, message: t('action.labelUnavailable') };
    return { success: false, message: t('action.failed') };
  }
}
