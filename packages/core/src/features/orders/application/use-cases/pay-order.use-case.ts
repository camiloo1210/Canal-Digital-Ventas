import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { PayOrderDto } from '@/orders/application/dtos/pay-order.dto';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createPaymentGatewayId } from '@/orders/domain/types/payment-gateway-id.type';

export class PayOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: PayOrderDto): Promise<void> {
    const orderId = createOrderId(dto.orderId);
    const tenantId = createTenantId(dto.tenantId);
    const paymentGatewayId = createPaymentGatewayId(dto.paymentGatewayId);

    const order = await this.orderRepository.findById(orderId, tenantId);

    if (!order) {
      throw new OrderNotFoundException();
    }

    order.markAsPaid(paymentGatewayId);

    await this.orderRepository.save(order);
    await this.eventBus.publish(order.domainEvents);
    order.clearDomainEvents();
  }
}
