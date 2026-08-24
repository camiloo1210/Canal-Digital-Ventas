import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { AddItemToCartDto } from '@/orders/application/dtos/add-item-to-cart.dto';
import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { OrderItemId } from '@/orders/domain/types/order-item-id.type';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';

export class AddItemToCartUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: AddItemToCartDto): Promise<void> {
    const order = await this.orderRepository.findPendingByCustomerId(dto.customerId, dto.tenantId);

    if (!order) {
      throw new OrderNotFoundException(
        'No active cart found for this customer. Please create an order first.',
      );
    }

    // In a real system, you might get the currency from the DTO or the tenant settings
    const unitPrice = Money.from(dto.unitPriceValue, 'USD');

    // In production, use a dedicated ID generator or UUID
    const orderItemId = crypto.randomUUID() as OrderItemId;

    const item = OrderItem.create(
      orderItemId,
      dto.productId,
      dto.productName,
      dto.quantity,
      unitPrice,
      dto.sku,
      dto.variantId,
    );

    order.addOrderItem(item);

    await this.orderRepository.save(order);
    await this.eventBus.publish(order.domainEvents);
    order.clearDomainEvents();
  }
}
