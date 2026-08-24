import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ChangeOrderStatusDto } from '@/orders/application/dtos/change-order-status.dto';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { UnsupportedOrderStatusException } from '@/orders/application/exceptions/unsupported-order-status.exception';

export class ChangeOrderStatusUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeOrderStatusDto): Promise<void> {
    const order = await this.orderRepository.findById(dto.orderId, dto.tenantId);

    if (!order) {
      throw new OrderNotFoundException();
    }

    switch (dto.status) {
      case OrderStatus.PROCESSING:
        order.markAsProcessing();
        break;
      case OrderStatus.SHIPPED:
        order.markAsShipped();
        break;
      case OrderStatus.CANCELLED:
        order.cancel();
        break;
      default:
        throw new UnsupportedOrderStatusException(dto.status);
    }

    await this.orderRepository.save(order);
    await this.eventBus.publish(order.domainEvents);
    order.clearDomainEvents();
  }
}
