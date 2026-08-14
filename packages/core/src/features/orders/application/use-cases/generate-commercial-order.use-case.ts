import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { GenerateCommercialOrderDto } from '@/orders/application/dtos/generate-commercial-order.dto';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';

export class GenerateCommercialOrderUseCase {
  constructor(private readonly orderRepository: OrderRepositoryPort) {}

  async execute(dto: GenerateCommercialOrderDto): Promise<void> {
    const order = await this.orderRepository.findById(dto.orderId, dto.tenantId);

    if (!order) {
      throw new OrderNotFoundException();
    }
    order.confirm();

    await this.orderRepository.save(order);
  }
}
