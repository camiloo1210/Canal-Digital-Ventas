import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { PayOrderDto } from '@/orders/application/dtos/pay-order.dto';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';

export class PayOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: PayOrderDto): Promise<void> {
    const order = await this.orderRepository.findById(dto.orderId, dto.tenantId);

    if (!order) {
      throw new OrderNotFoundException();
    }

    order.markAsPaid(dto.paymentGatewayId);

    await this.orderRepository.save(order);
    await this.eventBus.publish(order.domainEvents);
    order.clearDomainEvents();
  }
}
