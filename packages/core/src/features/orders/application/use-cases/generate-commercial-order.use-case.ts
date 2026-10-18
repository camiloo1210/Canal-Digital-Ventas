import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { GenerateCommercialOrderDto } from '@/orders/application/dtos/generate-commercial-order.dto';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class GenerateCommercialOrderUseCase {
  constructor(private readonly orderRepository: OrderRepositoryPort) {}

  async execute(dto: GenerateCommercialOrderDto): Promise<void> {
    const orderId = createOrderId(dto.orderId);
    const tenantId = createTenantId(dto.tenantId);

    const order = await this.orderRepository.findById(orderId, tenantId);

    if (!order) {
      throw new OrderNotFoundException();
    }
    order.confirm();

    await this.orderRepository.save(order);
  }
}
