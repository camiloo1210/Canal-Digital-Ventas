import { PaymentId } from '@/payments/domain/types/payment-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { OrderId } from '@/payments/domain/types/order-id.type';
import { CustomerId } from '@/payments/domain/types/customer-id.type';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';
import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { InvalidPaymentAttributeException } from '@/payments/domain/exceptions/invalid-payment-attribute.exception';
import { InvalidPaymentStateException } from '@/payments/domain/exceptions/invalid-payment-state.exception';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { PaymentCreatedEvent } from '@/payments/domain/events/payment-created.event';
import { PaymentCompletedEvent } from '@/payments/domain/events/payment-completed.event';
import { PaymentFailedEvent } from '@/payments/domain/events/payment-failed.event';
import { PaymentRefundedEvent } from '@/payments/domain/events/payment-refunded.event';

export interface PaymentProps {
  id: PaymentId;
  orderId: OrderId;
  tenantId: TenantId;
  customerId: CustomerId;
  status: PaymentStatus;
  gateway: PaymentGateway;
  amount: Money;
  gatewayTransactionId: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Payment {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: PaymentId,
    private readonly orderId: OrderId,
    private readonly tenantId: TenantId,
    private readonly customerId: CustomerId,
    private status: PaymentStatus,
    private readonly gateway: PaymentGateway,
    private readonly amount: Money,
    private gatewayTransactionId: string | null,
    private failureReason: string | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private version: number,
  ) {}

  public static create(
    id: PaymentId,
    orderId: OrderId,
    tenantId: TenantId,
    customerId: CustomerId,
    gateway: PaymentGateway,
    amount: Money,
  ): Payment {
    Payment.validateId(id);
    Payment.validateOrderId(orderId);
    Payment.validateTenantId(tenantId);
    Payment.validateCustomerId(customerId);
    Payment.validateGateway(gateway);
    Payment.validateAmount(amount);

    const payment = new Payment(
      id,
      orderId,
      tenantId,
      customerId,
      PaymentStatus.PENDING,
      gateway,
      amount,
      null, // gatewayTransactionId
      null, // failureReason
      new Date(), // createdAt
      new Date(), // updatedAt
      0, // initial version
    );

    payment.addDomainEvent(new PaymentCreatedEvent(id));
    return payment;
  }

  // Validations
  private static validateId(id: PaymentId): void {
    if (!id || id.trim().length === 0) {
      throw new InvalidPaymentAttributeException('Payment ID is required.');
    }
  }

  private static validateOrderId(orderId: OrderId): void {
    if (!orderId || orderId.trim().length === 0) {
      throw new InvalidPaymentAttributeException('Order ID is required.');
    }
  }

  private static validateTenantId(tenantId: TenantId): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new InvalidTenantIdException('Tenant ID is required and must be a valid string.');
    }
  }

  private static validateCustomerId(customerId: CustomerId): void {
    if (!customerId || customerId.trim().length === 0) {
      throw new InvalidPaymentAttributeException('Customer ID is required.');
    }
  }

  private static validateGateway(gateway: PaymentGateway): void {
    if (!gateway || !Object.values(PaymentGateway).includes(gateway)) {
      throw new InvalidPaymentAttributeException('Invalid payment gateway.');
    }
  }

  private static validateAmount(amount: Money): void {
    if (!amount) {
      throw new InvalidPaymentAttributeException('Amount is required.');
    }
    if (amount.getValue() <= 0) {
      throw new InvalidPaymentAttributeException(
        'Payment amount must be strictly greater than zero.',
      );
    }
  }

  // Reconstitute
  public static reconstitute(props: PaymentProps): Payment {
    return new Payment(
      props.id,
      props.orderId,
      props.tenantId,
      props.customerId,
      props.status,
      props.gateway,
      props.amount,
      props.gatewayTransactionId,
      props.failureReason,
      props.createdAt,
      props.updatedAt,
      props.version,
    );
  }

  // Actions (Business Logic)

  public markAsCompleted(gatewayTransactionId: string): void {
    if (this.status !== PaymentStatus.PENDING) {
      throw new InvalidPaymentStateException('Only pending payments can be completed.');
    }
    if (!gatewayTransactionId || gatewayTransactionId.trim().length === 0) {
      throw new InvalidPaymentAttributeException(
        'Gateway transaction ID is required to complete the payment.',
      );
    }

    this.status = PaymentStatus.COMPLETED;
    this.gatewayTransactionId = gatewayTransactionId;
    this.addDomainEvent(new PaymentCompletedEvent(this.id, this.orderId));
    this.updateUpdatedAt();
  }

  public markAsFailed(reason: string): void {
    if (this.status !== PaymentStatus.PENDING) {
      throw new InvalidPaymentStateException('Only pending payments can be marked as failed.');
    }
    if (!reason || reason.trim().length === 0) {
      throw new InvalidPaymentAttributeException('Failure reason is required.');
    }

    this.status = PaymentStatus.FAILED;
    this.failureReason = reason;
    this.addDomainEvent(new PaymentFailedEvent(this.id, this.orderId, reason));
    this.updateUpdatedAt();
  }

  public refund(): void {
    if (this.status !== PaymentStatus.COMPLETED) {
      throw new InvalidPaymentStateException('Only completed payments can be refunded.');
    }

    this.status = PaymentStatus.REFUNDED;
    this.addDomainEvent(new PaymentRefundedEvent(this.id, this.orderId));
    this.updateUpdatedAt();
  }

  private updateUpdatedAt(): void {
    this.updatedAt = new Date();
    this.version++;
  }

  // Domain Events Management
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

  // Getters

  public getId(): PaymentId {
    return this.id;
  }

  public getOrderId(): OrderId {
    return this.orderId;
  }

  public getTenantId(): TenantId {
    return this.tenantId;
  }

  public getCustomerId(): CustomerId {
    return this.customerId;
  }

  public getStatus(): PaymentStatus {
    return this.status;
  }

  public getGateway(): PaymentGateway {
    return this.gateway;
  }

  public getAmount(): Money {
    return this.amount;
  }

  public getGatewayTransactionId(): string | null {
    return this.gatewayTransactionId;
  }

  public getFailureReason(): string | null {
    return this.failureReason;
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
