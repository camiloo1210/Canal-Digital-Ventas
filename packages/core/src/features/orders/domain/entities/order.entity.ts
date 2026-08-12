import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
export interface OrderProps {
  id: string;
  orderNumber: string;
  customerId: string;
  tenantId: number;
  items: OrderItem[];
  status: OrderStatus;
  subtotal: Money;
  taxAmount: Money;
  discountAmount: Money;
  shippingCost: Money;
  totalAmount: Money;
  shippingAddress: Address;
  paymentGatewayId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Order {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: string,
    private readonly orderNumber: string,
    private readonly customerId: string,
    private readonly tenantId: number,
    private items: OrderItem[],
    private status: OrderStatus,
    private subtotal: Money,
    private taxAmount: Money,
    private discountAmount: Money,
    private shippingCost: Money,
    private totalAmount: Money,
    private shippingAddress: Address,
    private paymentGatewayId: string | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  public static create(
    id: string,
    orderNumber: string,
    customerId: string,
    tenantId: number,
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
      OrderStatus.PENDING_PAYMENT,
      subtotal,
      taxAmount,
      discountAmount,
      shippingCost,
      calculatedTotal,
      shippingAddress,
      null,
      new Date(),
      new Date(),
    );

    order.addDomainEvent({ eventName: 'OrderCreatedEvent', orderId: id });
    return order;
  }
  //Validations
  private static validateId(id: string): void {
    if (!id || id.trim().length === 0) {
      throw new InvalidOrderAttributeException('Order ID is required.');
    }
  }

  private static validateOrderNumber(orderNumber: string): void {
    if (!orderNumber || orderNumber.trim().length === 0) {
      throw new InvalidOrderAttributeException('Order number is required.');
    }
  }

  private static validateCustomerId(customerId: string): void {
    if (!customerId || customerId.trim().length === 0) {
      throw new InvalidOrderAttributeException('Customer ID is required.');
    }
  }

  private static validateTenantId(tenantId: number): void {
    if (tenantId === undefined || tenantId === null || tenantId <= 0) {
      throw new InvalidTenantIdException('Tenant ID is required and must be a positive number.');
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
  private static validatePaymentGatewayId(paymentGatewayId: string | null): void {
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
    const allowedStates = [OrderStatus.PENDING_PAYMENT, OrderStatus.PROCESSING];
    if (!allowedStates.includes(this.status)) {
      throw new InvalidOrderStateException(
        'Solo se puede cambiar la dirección de envío en órdenes pendientes o en proceso.',
      );
    }
    Order.validateShippingAddress(shippingAddress);
    this.shippingAddress = shippingAddress;
    this.updateUpdatedAt();
  }

  private updateUpdatedAt(): void {
    this.updatedAt = new Date();
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

  public markAsPaid(paymentGatewayId: string): void {
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
    if (this.status !== OrderStatus.PENDING_PAYMENT) {
      throw new InvalidOrderStateException('Cannot add items to an order that is not pending.');
    }
    this.items.push(item);
    this.recalculateAllTotals();
    this.updateUpdatedAt();
  }

  public removeOrderItem(itemId: string): void {
    if (this.status !== OrderStatus.PENDING_PAYMENT) {
      throw new InvalidOrderStateException(
        'Cannot remove items from an order that is not pending.',
      );
    }
    this.items = this.items.filter((i) => i.getId() !== itemId);
    if (this.items.length === 0)
      throw new InvalidOrderAttributeException('Order must have at least one item.');
    this.recalculateAllTotals();
    this.updateUpdatedAt();
  }

  public changeItemQuantity(itemId: string, quantity: number): void {
    if (this.status !== OrderStatus.PENDING_PAYMENT) {
      throw new InvalidOrderStateException(
        'Cannot change quantities on an order that is not pending.',
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

    let newSubtotalValue = 0;
    for (const item of this.items) {
      newSubtotalValue += item.getSubtotal().getValue();
    }

    const moneyClass = this.subtotal.constructor as any;
    this.subtotal = moneyClass.from(newSubtotalValue, currency);

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

  public getId(): string {
    return this.id;
  }

  public getOrderNumber(): string {
    return this.orderNumber;
  }

  public getCustomerId(): string {
    return this.customerId;
  }

  public getTenantId(): number {
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

  public getPaymentGatewayId(): string | null {
    return this.paymentGatewayId;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
