import type { SellerOrderAccessPort } from '@/orders/application/ports/out/seller-order-access.port';
import type { OrderLifecycleRepositoryPort } from '@/orders/application/ports/out/order-payment-automation.port';
import type { ManualShipmentRepositoryPort } from '@/orders/application/ports/out/manual-shipment-repository.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import type { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { OrderShipmentUpdatedEvent } from '@/orders/domain/events/order-shipment-updated.event';
import { ORDER_AGGREGATE_TYPE } from '@/orders/application/outbox/order-aggregate.constants';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { ManualShipmentDetails } from '@/orders/domain/value-objects/manual-shipment-details.vo';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';

export interface ShipmentTrackingInvalidationPort {
  invalidateIfChanged(
    tenantId: string,
    orderId: string,
    trackingNumber: string | null,
    tx: TransactionContext,
  ): Promise<void>;
}
export interface RegisterManualShipmentDto {
  readonly orderId: string;
  readonly tenantId: string;
  readonly authenticatedSellerId: string;
  readonly expectedShipmentVersion: number;
  readonly carrier: string | null;
  readonly trackingNumber: string | null;
}
export class RegisterManualShipmentUseCase {
  public constructor(
    private readonly access: SellerOrderAccessPort,
    private readonly orders: Pick<OrderLifecycleRepositoryPort, 'findByIdForUpdate'>,
    private readonly shipments: ManualShipmentRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly events: EventBusPort | null,
    private readonly tracking: ShipmentTrackingInvalidationPort | null = null,
  ) {}
  public async execute(dto: RegisterManualShipmentDto): Promise<void> {
    const orderId = createOrderId(dto.orderId);
    const tenantId = createTenantId(dto.tenantId);
    const actor = createGlobalAuthId(dto.authenticatedSellerId);
    if (!Number.isSafeInteger(dto.expectedShipmentVersion) || dto.expectedShipmentVersion < 0)
      throw new OptimisticConcurrencyException('Shipment', orderId);
    const details = ManualShipmentDetails.create(dto.carrier, dto.trackingNumber);
    await this.transactions.runInTransaction(
      async (tx): Promise<void> => {
        await this.access.assertCanManage(actor, tenantId, orderId, tx);
        const order = await this.orders.findByIdForUpdate(orderId, tenantId, tx);
        if (!order) throw new OrderNotFoundException();
        if (
          ![
            OrderStatus.PAID,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
          ].includes(order.getStatus())
        )
          throw new InvalidOrderStateException(
            'Shipment details cannot be changed in this order state.',
          );
        await this.shipments.save(
          {
            orderId,
            tenantId,
            actorId: actor,
            expectedVersion: dto.expectedShipmentVersion,
            carrier: details.getCarrier(),
            trackingNumber: details.getTrackingNumber(),
          },
          tx,
        );
        await this.tracking?.invalidateIfChanged(
          tenantId,
          orderId,
          details.getTrackingNumber(),
          tx,
        );
        if (this.events)
          await this.events.publish(
            [
              {
                context: { tenantId, aggregateType: ORDER_AGGREGATE_TYPE, aggregateId: orderId },
                event: new OrderShipmentUpdatedEvent(orderId),
              },
            ],
            tx,
          );
      },
      { userId: actor, tenantId },
    );
  }
}
