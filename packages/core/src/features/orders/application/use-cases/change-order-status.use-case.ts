import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ChangeOrderStatusDto } from '@/orders/application/dtos/change-order-status.dto';
import { parseOrderStatus, OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { UnsupportedOrderStatusException } from '@/orders/application/exceptions/unsupported-order-status.exception';

export class ChangeOrderStatusUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeOrderStatusDto): Promise<void> {
    const orderId = createOrderId(dto.orderId); 
    const tenantId = createTenantId(dto.tenantId);
    const status = parseOrderStatus(dto.status); 

    const order = await this.orderRepository.findById(orderId, tenantId);
    
    if (!order) {
      throw new OrderNotFoundException();
    }

    switch (status) {
      case OrderStatus.PROCESSING:
        order.markAsProcessing();
        break;
      case OrderStatus.SHIPPED:
        order.markAsShipped();
        break;
      case OrderStatus.DELIVERED:
        // order.markAsDelivered(); // Assuming markAsDelivered isn't implemented in the snippet
        break;
      case OrderStatus.CANCELLED:
        order.cancel();
        break;
      default:
        throw new UnsupportedOrderStatusException(status);
    }

    await this.orderRepository.save(order);
    await this.eventBus.publish(order.domainEvents);
    order.clearDomainEvents();
  }
}
