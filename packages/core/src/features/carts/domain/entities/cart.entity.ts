import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { CartId } from '@/carts/domain/types/cart-id.type';
import { CustomerId } from '@/carts/domain/types/customer-id.type';
import { CartStatus } from '@/carts/domain/enums/cart-status.enum';
import { CartItem } from '@/carts/domain/entities/cart-item.entity';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';
import { InvalidCartStateException } from '@/carts/domain/exceptions/invalid-cart-state.exception';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CartItemId } from '@/carts/domain/types/cart-item-id.type';
import { CartCreatedEvent } from '@/carts/domain/events/cart-created.event';
import { CartAbandonedEvent } from '@/carts/domain/events/cart-abandoned.event';
import { CartCompletedEvent } from '@/carts/domain/events/cart-completed.event';

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
  ) {
    this.items = items.map((item: CartItem): CartItem => Cart.snapshotItem(item));
  }

  public static create(
    id: CartId,
    tenantId: TenantId,
    customerId: CustomerId | null,
    expiresAt: Date,
    currency: Currency,
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
      Money.from(0, currency), // Tenant currency, fixed for the cart lifetime
      expiresAt,
      new Date(),
      new Date(),
      0,
    );

    cart.addDomainEvent(new CartCreatedEvent(id));
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
    if (!Cart.calculateSubtotal(props.items, props.subtotal.getCurrency()).equals(props.subtotal)) {
      throw new InvalidCartAttributeException('Cart subtotal must match its items and currency.');
    }
    return new Cart(
      props.id,
      props.tenantId,
      props.customerId,
      [...props.items],
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
      (i: CartItem): boolean =>
        i.getProductId() === item.getProductId() && i.getVariantId() === item.getVariantId(),
    );

    if (item.getUnitPrice().getCurrency() !== this.subtotal.getCurrency()) {
      throw new InvalidCartAttributeException('Cart items must share one currency.');
    }
    if (existingItem) {
      this.changeItemQuantity(
        existingItem.getId(),
        existingItem.getQuantity() + item.getQuantity(),
      );
      return;
    }
    this.replaceItems([...this.items, item]);
  }

  public removeItem(itemId: CartItemId): void {
    this.ensureIsActive();
    this.replaceItems(this.items.filter((item: CartItem): boolean => item.getId() !== itemId));
  }

  public changeItemQuantity(itemId: CartItemId, quantity: number): void {
    this.ensureIsActive();
    const item = this.items.find((candidate: CartItem): boolean => candidate.getId() === itemId);
    if (!item) throw new InvalidCartAttributeException('Item not found in cart.');
    const replacement = CartItem.create(
      item.getId(),
      item.getProductId(),
      item.getProductName(),
      quantity,
      item.getUnitPrice(),
      item.getSku(),
      item.getVariantId() ?? undefined,
    );
    this.replaceItems(
      this.items.map((candidate: CartItem): CartItem =>
        candidate === item ? replacement : candidate,
      ),
    );
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
    this.addDomainEvent(new CartAbandonedEvent(this.id));
  }

  public complete(): void {
    this.ensureIsActive();
    if (this.items.length === 0) {
      throw new InvalidCartStateException('Cannot complete an empty cart.');
    }
    this.status = CartStatus.COMPLETED;
    this.updateUpdatedAt();
    this.addDomainEvent(new CartCompletedEvent(this.id));
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

  private static calculateSubtotal(items: CartItem[], currency: Currency): Money {
    let subtotal = Money.from(0, currency);
    for (const item of items) {
      subtotal = subtotal.add(item.getSubtotal());
    }
    return subtotal;
  }

  private static snapshotItem(item: CartItem): CartItem {
    return CartItem.reconstitute({
      id: item.getId(),
      productId: item.getProductId(),
      productName: item.getProductName(),
      quantity: item.getQuantity(),
      unitPrice: item.getUnitPrice(),
      variantId: item.getVariantId(),
      sku: item.getSku(),
      subtotal: item.getSubtotal(),
    });
  }

  private replaceItems(items: CartItem[]): void {
    const currency = this.subtotal.getCurrency();
    if (items.some((item: CartItem): boolean => item.getUnitPrice().getCurrency() !== currency)) {
      throw new InvalidCartAttributeException('Cart items must share the cart currency.');
    }
    const subtotal = Cart.calculateSubtotal(items, currency);
    this.items = items.map((item: CartItem): CartItem => Cart.snapshotItem(item));
    this.subtotal = subtotal;
    this.updateUpdatedAt();
  }

  private recalculateSubtotal(): void {
    this.subtotal = Cart.calculateSubtotal(this.items, this.subtotal.getCurrency());
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
    return this.items.map((item: CartItem): CartItem => Cart.snapshotItem(item));
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
