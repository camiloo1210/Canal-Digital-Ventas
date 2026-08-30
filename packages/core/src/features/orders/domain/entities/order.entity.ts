import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { OrderId } from '@/orders/domain/types/order-id.type';
import { CustomerId } from '@/orders/domain/types/customer-id.type';
import { TenantId } from '@/orders/domain/types/tenant-id.type';
import { PaymentGatewayId } from '@/orders/domain/types/payment-gateway-id.type';

export interface OrderProps {
  id: OrderId;
  orderNumber: string;
  customerId: CustomerId;
  tenantId: TenantId;
  items: OrderItem[];
  status: OrderStatus;
  subtotal: Money;
  taxAmount: Money;
  discountAmount: Money;
  shippingCost: Money;
  totalAmount: Money;
  shippingAddress: Address;
  paymentGatewayId: PaymentGatewayId | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Order {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: OrderId,
    private readonly orderNumber: string,
    private readonly customerId: CustomerId,
    private readonly tenantId: TenantId,
    private items: OrderItem[],
    private status: OrderStatus,
    private subtotal: Money,
    private taxAmount: Money,
    private discountAmount: Money,
    private shippingCost: Money,
    private totalAmount: Money,
    private shippingAddress: Address,
    private paymentGatewayId: PaymentGatewayId | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private version: number,
  ) {}

  public static create(
    id: OrderId,
    orderNumber: string,
    customerId: CustomerId,
    tenantId: TenantId,
    items: OrderItem[],
    subtotal: Money,
    taxAmount: Money,
    discountAmount: Money,
    shippingCost: Money,
    shippingAddress: Address,
  ): Order {
    Order.validateId(id);
    Order.validateOrderNumber(orderNumber);
    Order.validateCustomerId(customerId);
    Order.validateTenantId(tenantId);
    Order.validateItems(items);
    Order.validateShippingAddress(shippingAddress);
    const calculatedTotal = subtotal.add(taxAmount).add(shippingCost).subtract(discountAmount);
    Order.validateAmounts(subtotal, taxAmount, discountAmount, shippingCost, calculatedTotal);

    const order = new Order(
      id,
      orderNumber,
      customerId,
      tenantId,
      items,
      OrderStatus.DRAFT,
      subtotal,
      taxAmount,
      discountAmount,
      shippingCost,
      calculatedTotal,
      shippingAddress,
      null,
      new Date(),
      new Date(),
      0, // Initial version
    );

    order.addDomainEvent({ eventName: 'OrderCreatedEvent', orderId: id });
    return order;
  }
  //Validations
  private static validateId(id: OrderId): void {
    if (!id || id.trim().length === 0) {
      throw new InvalidOrderAttributeException('Order ID is required.');
    }
  }

  private static validateOrderNumber(orderNumber: string): void {
    if (!orderNumber || orderNumber.trim().length === 0) {
      throw new InvalidOrderAttributeException('Order number is required.');
    }
  }

  private static validateCustomerId(customerId: CustomerId): void {
    if (!customerId || customerId.trim().length === 0) {
      throw new InvalidOrderAttributeException('Customer ID is required.');
    }
  }

  private static validateTenantId(tenantId: TenantId): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new InvalidTenantIdException('Tenant ID is required and must be a valid string.');
    }
  }
  private static validateStatus(status: OrderStatus): void {
    if (!status || !Object.values(OrderStatus).includes(status)) {
      throw new InvalidOrderAttributeException('Invalid order status.');
    }
  }
  private static validateItems(items: OrderItem[]): void {
    if (!items || items.length === 0) {
      throw new InvalidOrderAttributeException('Order must have at least one item.');
    }
  }
  private static validateAmounts(
    subtotal: Money,
    taxAmount: Money,
    discountAmount: Money,
    shippingCost: Money, // 4. MEJORA
    totalAmount: Money,
  ): void {
    if (!subtotal || !taxAmount || !discountAmount || !shippingCost || !totalAmount) {
      throw new InvalidOrderAttributeException('Amounts are required.');
    }
    if (
      subtotal.getValue() +
        taxAmount.getValue() +
        shippingCost.getValue() -
        discountAmount.getValue() !==
      totalAmount.getValue()
    ) {
      throw new InvalidOrderAttributeException('Invalid total amount.');
    }
  }
  private static validateShippingAddress(shippingAddress: Address): void {
    if (!shippingAddress) {
      throw new InvalidOrderAttributeException('Shipping address is required.');
    }
  }
  private static validatePaymentGatewayId(paymentGatewayId: PaymentGatewayId | null): void {
    if (paymentGatewayId !== null && paymentGatewayId.trim().length === 0) {
      throw new InvalidOrderAttributeException('Invalid payment gateway ID.');
    }
  }
  private static validateTimestamps(createdAt: Date, updatedAt: Date): void {
    if (!createdAt || !updatedAt) {
      throw new InvalidOrderAttributeException('Timestamps are required.');
    }
    if (createdAt > updatedAt) {
      throw new InvalidOrderAttributeException('Created at date must be before updated at date.');
    }
  }
  //Updates
  public changeShippingAddress(shippingAddress: Address): void {
    const allowedStates = [OrderStatus.DRAFT, OrderStatus.PENDING_PAYMENT, OrderStatus.PROCESSING];
    if (!allowedStates.includes(this.status)) {
      throw new InvalidOrderStateException(
        'Solo se puede cambiar la dirección de envío en estado de borrador, pendiente de pago o en proceso.',
      );
    }
    Order.validateShippingAddress(shippingAddress);
    this.shippingAddress = shippingAddress;
    this.updateUpdatedAt();
  }

  private updateUpdatedAt(): void {
    this.updatedAt = new Date();
    this.version++;
  }

  //Reconstitute
  public static reconstitute(props: OrderProps): Order {
    return new Order(
      props.id,
      props.orderNumber,
      props.customerId,
      props.tenantId,
      props.items,
      props.status,
      props.subtotal,
      props.taxAmount,
      props.discountAmount,
      props.shippingCost,
      props.totalAmount,
      props.shippingAddress,
      props.paymentGatewayId,
      props.createdAt,
      props.updatedAt,
      props.version,
    );
  }
  //Actions(Business Logic)
  public markAsShipped(): void {
    if (this.status !== OrderStatus.PAID && this.status !== OrderStatus.PROCESSING) {
      throw new InvalidOrderStateException('Order must be paid or processing to be shipped.');
    }
    this.status = OrderStatus.SHIPPED;
    this.addDomainEvent({ eventName: 'OrderShippedEvent', orderId: this.id });
  }

  public confirm(): void {
    if (this.status !== OrderStatus.DRAFT) {
      throw new InvalidOrderStateException(
        'Solo los pedidos en estado de carrito (DRAFT) pueden ser confirmados.',
      );
    }
    if (this.items.length === 0) {
      throw new InvalidOrderStateException('No se puede confirmar un pedido sin productos.');
    }

    this.status = OrderStatus.PENDING_PAYMENT;
    // this.addDomainEvent({ eventName: 'OrderConfirmedEvent', orderId: this.id });
  }

  public markAsPaid(paymentGatewayId: PaymentGatewayId): void {
    if (this.status !== OrderStatus.PENDING_PAYMENT) {
      throw new InvalidOrderStateException('Order must be pending to be paid.');
    }
    this.status = OrderStatus.PAID;
    this.paymentGatewayId = paymentGatewayId;
    this.addDomainEvent({ eventName: 'OrderPaidEvent', orderId: this.id, paymentGatewayId });
  }

  public markAsProcessing(): void {
    if (this.status !== OrderStatus.PAID) {
      throw new InvalidOrderStateException('Order must be paid to be processed.');
    }
    this.status = OrderStatus.PROCESSING;
    this.addDomainEvent({ eventName: 'OrderProcessingEvent', orderId: this.id });
  }
  public cancel(): void {
    if (this.status === OrderStatus.SHIPPED || this.status === OrderStatus.DELIVERED) {
      throw new InvalidOrderStateException(
        'An order that has already been shipped or delivered cannot be cancelled.',
      );
    }
    this.status = OrderStatus.CANCELLED;
    this.addDomainEvent({ eventName: 'OrderCancelledEvent', orderId: this.id });
  }

  public addOrderItem(item: OrderItem): void {
    if (this.status !== OrderStatus.DRAFT) {
      throw new InvalidOrderStateException(
        'Solo se pueden añadir productos cuando el pedido es un carrito (DRAFT).',
      );
    }
    const existingItem = this.items.find(
      (i) => i.getProductId() === item.getProductId() && i.getVariantId() === item.getVariantId(),
    );
    if (existingItem) {
      existingItem.changeQuantity(existingItem.getQuantity() + item.getQuantity());
    } else {
      this.items.push(item);
    }
    this.recalculateAllTotals();
    this.updateUpdatedAt();
  }

  public removeOrderItem(itemId: string): void {
    if (this.status !== OrderStatus.DRAFT) {
      throw new InvalidOrderStateException(
        'Solo se pueden eliminar productos cuando el pedido es un carrito (DRAFT).',
      );
    }
    this.items = this.items.filter((i) => i.getId() !== itemId);
    if (this.items.length === 0)
      throw new InvalidOrderAttributeException('Order must have at least one item.');
    this.recalculateAllTotals();
    this.updateUpdatedAt();
  }

  public changeItemQuantity(itemId: string, quantity: number): void {
    if (this.status !== OrderStatus.DRAFT) {
      throw new InvalidOrderStateException(
        'Solo se pueden cambiar cantidades cuando el pedido es un carrito (DRAFT).',
      );
    }
    const item = this.items.find((i) => i.getId() === itemId);
    if (!item) throw new InvalidOrderAttributeException('Item not found in order.');
    item.changeQuantity(quantity);
    this.recalculateAllTotals();
    this.updateUpdatedAt();
  }

  private recalculateAllTotals(): void {
    if (this.items.length === 0) return;
    const currency = this.items[0].getUnitPrice().getCurrency();

    let newSubtotal = Money.from(0, currency);
    for (const item of this.items) {
      newSubtotal = newSubtotal.add(item.getSubtotal());
    }

    this.subtotal = newSubtotal;

    this.totalAmount = this.subtotal
      .add(this.taxAmount)
      .add(this.shippingCost)
      .subtract(this.discountAmount);
  }

  private addDomainEvent(event: Omit<DomainEvent, 'occurredOn'>): void {
    this._domainEvents.push({
      ...event,
      occurredOn: new Date(),
    } as DomainEvent);
  }
  public get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }
  public clearDomainEvents(): void {
    this._domainEvents.length = 0;
  }

  //Getters

  public getId(): OrderId {
    return this.id;
  }

  public getOrderNumber(): string {
    return this.orderNumber;
  }

  public getCustomerId(): CustomerId {
    return this.customerId;
  }

  public getTenantId(): TenantId {
    return this.tenantId;
  }

  public getItems(): OrderItem[] {
    return [...this.items];
  }

  public getStatus(): OrderStatus {
    return this.status;
  }

  public getSubtotal(): Money {
    return this.subtotal;
  }

  public getTaxAmount(): Money {
    return this.taxAmount;
  }

  public getDiscountAmount(): Money {
    return this.discountAmount;
  }

  public getShippingCost(): Money {
    return this.shippingCost;
  }

  public getTotalAmount(): Money {
    return this.totalAmount;
  }

  public getShippingAddress(): Address {
    return this.shippingAddress;
  }

  public getPaymentGatewayId(): PaymentGatewayId | null {
    return this.paymentGatewayId;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }

  public getVersion(): number {
    return this.version;
  }
}
