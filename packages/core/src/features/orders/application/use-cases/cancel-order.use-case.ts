import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { CancelOrderDto } from '@/orders/application/dtos/cancel-order.dto';

export class CancelOrderUseCase {
  constructor(private readonly orderRepository: OrderRepositoryPort) {}

  async execute(dto: CancelOrderDto): Promise<void> {
    const order = await this.orderRepository.findById(dto.orderId, dto.tenantId);

    if (!order) {
      throw new Error('Order not found');
    }

    order.cancel();

    await this.orderRepository.save(order);
  }
}
