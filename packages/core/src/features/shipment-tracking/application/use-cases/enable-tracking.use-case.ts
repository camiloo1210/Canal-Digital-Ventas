import type { SellerOrderAccessPort } from '@/orders/application/ports/out/seller-order-access.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';

export interface TrackingActivationRepositoryPort {
  readForUpdate(
    tenantId: string,
    orderId: string,
    tx: TransactionContext,
  ): Promise<{ readonly trackingNumber: string | null; readonly version: number } | null>;
  enable(
    input: {
      readonly tenantId: string;
      readonly orderId: string;
      readonly trackingNumber: string;
      readonly provider: 'fedex';
    },
    tx: TransactionContext,
  ): Promise<void>;
}
export interface EnableTrackingDto {
  readonly tenantId: string;
  readonly orderId: string;
  readonly authenticatedSellerId: string;
  readonly expectedShipmentVersion: number;
  readonly provider: 'fedex';
}
export class EnableTrackingUseCase {
  public constructor(
    private readonly access: SellerOrderAccessPort,
    private readonly repository: TrackingActivationRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly sandboxEnabled: boolean,
  ) {}
  public async execute(input: EnableTrackingDto): Promise<void> {
    const tenantId = createTenantId(input.tenantId);
    const orderId = createOrderId(input.orderId);
    const actor = createGlobalAuthId(input.authenticatedSellerId);
    if (!this.sandboxEnabled || input.provider !== 'fedex')
      throw new InvalidOrderAttributeException('Tracking unavailable');
    if (!Number.isSafeInteger(input.expectedShipmentVersion) || input.expectedShipmentVersion < 1)
      throw new OptimisticConcurrencyException('Shipment', orderId);
    await this.transactions.runInTransaction(
      async (tx): Promise<void> => {
        await this.access.assertCanManage(actor, tenantId, orderId, tx);
        const shipment = await this.repository.readForUpdate(tenantId, orderId, tx);
        if (!shipment || shipment.version !== input.expectedShipmentVersion)
          throw new OptimisticConcurrencyException('Shipment', orderId);
        if (!shipment.trackingNumber?.trim())
          throw new InvalidOrderAttributeException('Tracking number required');
        await this.repository.enable(
          { tenantId, orderId, trackingNumber: shipment.trackingNumber, provider: 'fedex' },
          tx,
        );
      },
      { userId: actor, tenantId },
    );
  }
}
