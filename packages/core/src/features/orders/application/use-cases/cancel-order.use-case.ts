import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { CancelOrderDto } from '@/orders/application/dtos/cancel-order.dto';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';

export class CancelOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: CancelOrderDto): Promise<void> {
    const order = await this.orderRepository.findById(dto.orderId, dto.tenantId);

    if (!order) {
      throw new OrderNotFoundException();
    }

    order.cancel();

    await this.orderRepository.save(order);
    await this.eventBus.publish(order.domainEvents);
    order.clearDomainEvents();
  }
}
