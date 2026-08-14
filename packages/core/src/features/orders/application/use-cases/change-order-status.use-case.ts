import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { ChangeOrderStatusDto } from '@/orders/application/dtos/change-order-status.dto';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';

export class ChangeOrderStatusUseCase {
  constructor(private readonly orderRepository: OrderRepositoryPort) {}

  async execute(dto: ChangeOrderStatusDto): Promise<void> {
    const order = await this.orderRepository.findById(dto.orderId, dto.tenantId);

    if (!order) {
      throw new Error('Order not found');
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
        throw new Error(`Cannot manually change status to ${dto.status} through this use case.`);
    }

    await this.orderRepository.save(order);
  }
}
