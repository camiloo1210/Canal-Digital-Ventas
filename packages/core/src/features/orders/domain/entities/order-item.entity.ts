import { Money } from '@/shared/domain/value-objects/money.vo';
import { InvalidQuantityException } from '@/orders/domain/exceptions/invalid-quantity.exception';
import { InvalidUnitPriceException } from '@/orders/domain/exceptions/invalid-unit-price.exception';
export interface OrderItemProps {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  variantId: string | null;
  sku: string;
  subtotal: Money;
}

export class OrderItem {
  private constructor(
    private readonly id: string,
    private readonly productId: string,
    private readonly productName: string,
    private quantity: number,
    private readonly unitPrice: Money,
    private readonly variantId: string | null,
    private readonly sku: string,
    private subtotal: Money,
  ) {}

  public static create(
    id: string,
    productId: string,
    productName: string,
    quantity: number,
    unitPrice: Money,
    sku: string,
    variantId?: string,
  ): OrderItem {
    if (quantity <= 0) throw new InvalidQuantityException();
    const subtotal = unitPrice.multiply(quantity);
    return new OrderItem(
      id,
      productId,
      productName,
      quantity,
      unitPrice,
      variantId || null,
      sku,
      subtotal,
    );
  }
  // Reconstitute
  public static reconstitute(props: OrderItemProps): OrderItem {
    OrderItem.validateQuantity(props.quantity);
    OrderItem.validateUnitPrice(props.unitPrice.getValue());
    return new OrderItem(
      props.id,
      props.productId,
      props.productName,
      props.quantity,
      props.unitPrice,
      props.variantId || null,
      props.sku,
      props.subtotal,
    );
  }
  //Validations
  private static validateQuantity(quantity: number): void {
    if (quantity <= 0) throw new InvalidQuantityException();
  }
  private static validateUnitPrice(unitPrice: number): void {
    if (unitPrice <= 0) throw new InvalidUnitPriceException();
  }

  //Actions

  //Domain Methods
  public updateQuantity(newQuantity: number): void {
    OrderItem.validateQuantity(newQuantity);
    this.quantity = newQuantity;
    this.subtotal = this.unitPrice.multiply(newQuantity);
  }

  //Getters
  public getId(): string {
    return this.id;
  }
  public getProductId(): string {
    return this.productId;
  }
  public getProductName(): string {
    return this.productName;
  }
  public getQuantity(): number {
    return this.quantity;
  }
  public getUnitPrice(): Money {
    return this.unitPrice;
  }
  public getVariantId(): string {
    return this.variantId;
  }
  public getSku(): string {
    return this.sku;
  }
  public getSubtotal(): Money {
    return this.subtotal;
  }
}
