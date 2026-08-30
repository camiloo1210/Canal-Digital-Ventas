import { TenantId } from '@/carts/domain/types/tenant-id.type';
import { CartId } from '@/carts/domain/types/cart-id.type';
import { CustomerId } from '@/carts/domain/types/customer-id.type';
import { CartStatus } from '@/carts/domain/enums/cart-status.enum';
import { CartItem } from '@/carts/domain/entities/cart-item.entity';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';
import { InvalidCartStateException } from '@/carts/domain/exceptions/invalid-cart-state.exception';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CartItemId } from '@/carts/domain/types/cart-item-id.type';

export interface CartProps {
  id: CartId;
  tenantId: TenantId;
  customerId: CustomerId | null;
  items: CartItem[];
  status: CartStatus;
  subtotal: Money;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Cart {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: CartId,
    private readonly tenantId: TenantId,
    private customerId: CustomerId | null,
    private items: CartItem[],
    private status: CartStatus,
    private subtotal: Money,
    private expiresAt: Date,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private version: number,
  ) {}

  public static create(
    id: CartId,
    tenantId: TenantId,
    customerId: CustomerId | null,
    expiresAt: Date,
  ): Cart {
    Cart.validateId(id);
    Cart.validateTenantId(tenantId);
    Cart.validateExpiresAt(expiresAt);

    const cart = new Cart(
      id,
      tenantId,
      customerId,
      [],
      CartStatus.ACTIVE,
      Money.from(0, 'USD'), // Default currency, will adapt on first item added
      expiresAt,
      new Date(),
      new Date(),
      0,
    );

    cart.addDomainEvent({ eventName: 'CartCreatedEvent', cartId: id });
    return cart;
  }

  // Validations
  private static validateId(id: CartId): void {
    if (!id || id.trim().length === 0) {
      throw new InvalidCartAttributeException('Cart ID is required.');
    }
  }

  private static validateTenantId(tenantId: TenantId): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new InvalidTenantIdException('Tenant ID is required and must be a valid string.');
    }
  }

  private static validateExpiresAt(expiresAt: Date): void {
    if (!expiresAt) {
      throw new InvalidCartAttributeException('Expiration date is required.');
    }
    if (expiresAt < new Date()) {
      throw new InvalidCartAttributeException('Expiration date cannot be in the past.');
    }
  }

  // Reconstitute
  public static reconstitute(props: CartProps): Cart {
    return new Cart(
      props.id,
      props.tenantId,
      props.customerId,
      props.items,
      props.status,
      props.subtotal,
      props.expiresAt,
      props.createdAt,
      props.updatedAt,
      props.version,
    );
  }

  // Business Logic / Actions
  public addItem(item: CartItem): void {
    this.ensureIsActive();

    const existingItem = this.items.find(
      (i) => i.getProductId() === item.getProductId() && i.getVariantId() === item.getVariantId(),
    );

    if (existingItem) {
      existingItem.changeQuantity(existingItem.getQuantity() + item.getQuantity());
    } else {
      this.items.push(item);
    }

    this.recalculateSubtotal();
    this.updateUpdatedAt();
  }

  public removeItem(itemId: CartItemId): void {
    this.ensureIsActive();

    this.items = this.items.filter((i) => i.getId() !== itemId);
    this.recalculateSubtotal();
    this.updateUpdatedAt();
  }

  public changeItemQuantity(itemId: CartItemId, quantity: number): void {
    this.ensureIsActive();

    const item = this.items.find((i) => i.getId() === itemId);
    if (!item) {
      throw new InvalidCartAttributeException('Item not found in cart.');
    }

    item.changeQuantity(quantity);
    this.recalculateSubtotal();
    this.updateUpdatedAt();
  }

  public clear(): void {
    this.ensureIsActive();
    this.items = [];
    this.recalculateSubtotal();
    this.updateUpdatedAt();
  }

  public abandon(): void {
    this.ensureIsActive();
    this.status = CartStatus.ABANDONED;
    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'CartAbandonedEvent', cartId: this.id });
  }

  public complete(): void {
    this.ensureIsActive();
    if (this.items.length === 0) {
      throw new InvalidCartStateException('Cannot complete an empty cart.');
    }
    this.status = CartStatus.COMPLETED;
    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'CartCompletedEvent', cartId: this.id });
  }

  public assignCustomer(customerId: CustomerId): void {
    this.ensureIsActive();
    this.customerId = customerId;
    this.updateUpdatedAt();
  }

  private ensureIsActive(): void {
    if (this.status !== CartStatus.ACTIVE) {
      throw new InvalidCartStateException(
        `Cart is no longer active (current status: ${this.status}).`,
      );
    }
    if (this.expiresAt < new Date()) {
      this.status = CartStatus.ABANDONED;
      throw new InvalidCartStateException('Cart has expired and was marked as abandoned.');
    }
  }

  private recalculateSubtotal(): void {
    if (this.items.length === 0) {
      this.subtotal = Money.from(0, 'USD'); // Fallback currency
      return;
    }

    const currency = this.items[0].getUnitPrice().getCurrency();
    let newSubtotal = Money.from(0, currency);

    for (const item of this.items) {
      newSubtotal = newSubtotal.add(item.getSubtotal());
    }

    this.subtotal = newSubtotal;
  }

  private updateUpdatedAt(): void {
    this.updatedAt = new Date();
    this.version++;
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

  // Getters
  public getId(): CartId {
    return this.id;
  }
  public getTenantId(): TenantId {
    return this.tenantId;
  }
  public getCustomerId(): CustomerId | null {
    return this.customerId;
  }
  public getItems(): CartItem[] {
    return [...this.items];
  }
  public getStatus(): CartStatus {
    return this.status;
  }
  public getSubtotal(): Money {
    return this.subtotal;
  }
  public getExpiresAt(): Date {
    return this.expiresAt;
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
