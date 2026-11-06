import { Money } from '@/shared/domain/value-objects/money.vo';
import { InvalidQuantityException } from '@/orders/domain/exceptions/invalid-quantity.exception';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';
import { ProductId } from '@/orders/domain/types/product-id.type';
import { OrderItemId } from '@/orders/domain/types/order-item-id.type';
import { VariantId } from '@/orders/domain/types/variant-id.type';

export interface OrderItemProps {
  id: OrderItemId;
  productId: ProductId;
  productName: string;
  quantity: number;
  unitPrice: Money;
  variantId: VariantId | null;
  sku: string;
  subtotal: Money;
}

export class OrderItem {
  private constructor(
    private readonly id: OrderItemId,
    private readonly productId: ProductId,
    private readonly productName: string,
    private quantity: number,
    private readonly unitPrice: Money,
    private readonly variantId: VariantId | null,
    private readonly sku: string,
    private subtotal: Money,
  ) {}

  public static create(
    id: OrderItemId,
    productId: ProductId,
    productName: string,
    quantity: number,
    unitPrice: Money,
    sku: string,
    variantId?: VariantId,
  ): OrderItem {
    OrderItem.validateQuantity(quantity);
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
    if (!props.unitPrice.multiply(props.quantity).equals(props.subtotal)) {
      throw new InvalidOrderAttributeException(
        'Item subtotal must equal unit price times quantity in the same currency.',
      );
    }
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
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new InvalidQuantityException();
  }

  //Actions

  //Domain Methods

  public changeQuantity(newQuantity: number): void {
    OrderItem.validateQuantity(newQuantity);
    const subtotal = this.unitPrice.multiply(newQuantity);
    this.quantity = newQuantity;
    this.subtotal = subtotal;
  }

  //Getters
  public getId(): OrderItemId {
    return this.id;
  }
  public getProductId(): ProductId {
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
  public getVariantId(): VariantId | null {
    return this.variantId;
  }
  public getSku(): string {
    return this.sku;
  }
  public getSubtotal(): Money {
    return this.subtotal;
  }
}
