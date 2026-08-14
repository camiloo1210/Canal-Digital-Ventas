import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { PayOrderDto } from '@/orders/application/dtos/pay-order.dto';

export class PayOrderUseCase {
  constructor(private readonly orderRepository: OrderRepositoryPort) {}

  async execute(dto: PayOrderDto): Promise<void> {
    const order = await this.orderRepository.findById(dto.orderId, dto.tenantId);

    if (!order) {
      throw new Error('Order not found');
    }

    order.markAsPaid(dto.paymentGatewayId);

    await this.orderRepository.save(order);
  }
}
