import type {
  OrderAutomationPayment,
  OrderLifecycleRepositoryPort,
  OrderPaymentAutomationPort,
} from '@/orders/application/ports/out/order-payment-automation.port';
import { Order } from '@/orders/domain/entities/order.entity';
import type { OrderId } from '@/orders/domain/types/order-id.type';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';

/**
 * Tenant-scoped order store for the payment-automation use cases. Stores snapshots: reads
 * return a fresh instance, so unsaved mutations never leak. `saveCount` counts saveLifecycle.
 */
export class FakeOrderLifecycleRepository implements OrderLifecycleRepositoryPort {
  private readonly store = new Map<string, Order>();
  public saveCount = 0;

  private static key(tenantId: string, orderId: string): string {
    return `${tenantId}::${orderId}`;
  }

  private static copy(order: Order): Order {
    return Order.reconstitute({
      id: order.getId(),
      orderNumber: order.getOrderNumber(),
      customerId: order.getCustomerId(),
      tenantId: order.getTenantId(),
      items: order.getItems(),
      status: order.getStatus(),
      subtotal: order.getSubtotal(),
      taxAmount: order.getTaxAmount(),
      discountAmount: order.getDiscountAmount(),
      shippingCost: order.getShippingCost(),
      totalAmount: order.getTotalAmount(),
      shippingAddress: order.getShippingAddress(),
      paymentGatewayId: order.getPaymentGatewayId(),
      createdAt: order.getCreatedAt(),
      updatedAt: order.getUpdatedAt(),
      version: order.getVersion(),
    });
  }

  public seed(...orders: Order[]): void {
    for (const order of orders) {
      this.store.set(
        FakeOrderLifecycleRepository.key(order.getTenantId(), order.getId()),
        FakeOrderLifecycleRepository.copy(order),
      );
    }
  }

  /** Test helper: reads without a transaction context. */
  async peek(id: OrderId, tenantId: TenantId): Promise<Order | null> {
    return this.findByIdForUpdate(id, tenantId);
  }

  async findByIdForUpdate(id: OrderId, tenantId: TenantId): Promise<Order | null> {
    const stored = this.store.get(FakeOrderLifecycleRepository.key(tenantId, id));
    return stored ? FakeOrderLifecycleRepository.copy(stored) : null;
  }

  async saveLifecycle(order: Order): Promise<void> {
    this.saveCount++;
    this.seed(order);
  }
}

/** Configurable payment read model; `reserveExpiryCancellation` succeeds once per payment. */
export class FakeOrderPaymentAutomation implements OrderPaymentAutomationPort {
  private readonly payments = new Map<string, OrderAutomationPayment>();
  private readonly reserved = new Set<string>();

  public seed(orderId: string, payment: OrderAutomationPayment): void {
    this.payments.set(`${payment.tenantId}::${orderId}`, payment);
  }

  async read(orderId: OrderId, tenantId: TenantId): Promise<OrderAutomationPayment | null> {
    return this.payments.get(`${tenantId}::${orderId}`) ?? null;
  }

  async reserveExpiryCancellation(
    orderId: OrderId,
    paymentId: string,
    tenantId: TenantId,
  ): Promise<boolean> {
    const key = `${tenantId}::${orderId}::${paymentId}`;
    if (this.reserved.has(key)) return false;
    this.reserved.add(key);
    return true;
  }
}
