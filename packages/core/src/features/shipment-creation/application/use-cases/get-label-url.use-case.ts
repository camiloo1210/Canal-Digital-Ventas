import type { SellerOrderAccessPort } from '@/orders/application/ports/out/seller-order-access.port';
import type { ShipmentLabelReadPort } from '@/shipment-creation/application/ports/out/shipment-label-read.port';
import type { LabelStoragePort } from '@/shipment-creation/application/ports/out/label-storage.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { ShipmentLabelUnavailableException } from '@/shipment-creation/application/exceptions/shipment-label-unavailable.exception';

export const LABEL_URL_SECONDS = 60;

export interface GetLabelUrlDto {
  readonly orderId: string;
  readonly tenantId: string;
  readonly authenticatedSellerId: string;
}

export class GetLabelUrlUseCase {
  public constructor(
    private readonly access: SellerOrderAccessPort,
    private readonly labels: ShipmentLabelReadPort,
    private readonly storage: LabelStoragePort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: GetLabelUrlDto): Promise<string> {
    const orderId = createOrderId(dto.orderId);
    const tenantId = createTenantId(dto.tenantId);
    const actor = createGlobalAuthId(dto.authenticatedSellerId);
    const path = await this.transactions.runInTransaction(
      async (tx): Promise<string> => {
        await this.access.assertCanManage(actor, tenantId, orderId, tx);
        const record = await this.labels.find(tenantId, orderId, tx);
        if (!record || record.state !== 'done' || !record.labelPath)
          throw new ShipmentLabelUnavailableException();
        return record.labelPath;
      },
      { userId: actor, tenantId },
    );
    return this.storage.signedUrl(path, LABEL_URL_SECONDS);
  }
}
