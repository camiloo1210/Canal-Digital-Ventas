import type { SellerOrderAccessPort } from '@/orders/application/ports/out/seller-order-access.port';
import type { ShipmentJobRepositoryPort } from '@/shipment-creation/application/ports/out/shipment-job-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { ShipmentNotRetryableException } from '@/shipment-creation/application/exceptions/shipment-not-retryable.exception';

export interface RetryShipmentDto {
  readonly orderId: string;
  readonly tenantId: string;
  readonly authenticatedSellerId: string;
}

export class RetryShipmentUseCase {
  public constructor(
    private readonly access: SellerOrderAccessPort,
    private readonly jobs: Pick<ShipmentJobRepositoryPort, 'retry'>,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: RetryShipmentDto): Promise<void> {
    const orderId = createOrderId(dto.orderId);
    const tenantId = createTenantId(dto.tenantId);
    const actor = createGlobalAuthId(dto.authenticatedSellerId);
    await this.transactions.runInTransaction(
      async (tx): Promise<void> => {
        await this.access.assertCanManage(actor, tenantId, orderId, tx);
        const requeued = await this.jobs.retry(tenantId, orderId, actor);
        if (!requeued) throw new ShipmentNotRetryableException();
      },
      { userId: actor, tenantId },
    );
  }
}
