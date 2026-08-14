import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { GenerateCommercialOrderDto } from '@/orders/application/dtos/generate-commercial-order.dto';

export class GenerateCommercialOrderUseCase {
  constructor(private readonly orderRepository: OrderRepositoryPort) {}

  async execute(dto: GenerateCommercialOrderDto): Promise<void> {
    const order = await this.orderRepository.findById(dto.orderId, dto.tenantId);

    if (!order) {
      throw new Error('Order not found');
    }

    // Business Logic:
    // In this step, the user confirms the cart.
    // Depending on your domain, this could change the status from a draft state to PENDING_PAYMENT,
    // freeze the prices, or trigger an OrderGeneratedDomainEvent.
    // Currently, Order initializes in PENDING_PAYMENT.

    // Example: order.confirm();

    await this.orderRepository.save(order);
  }
}
