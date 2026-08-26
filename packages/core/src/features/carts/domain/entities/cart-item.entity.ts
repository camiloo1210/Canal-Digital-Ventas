import { Money } from '@/shared/domain/value-objects/money.vo';
import { InvalidCartItemQuantityException } from '@/carts/domain/exceptions/invalid-cart-item-quantity.exception';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';
import { ProductId } from '@/carts/domain/types/product-id.type';
import { CartItemId } from '@/carts/domain/types/cart-item-id.type';
import { VariantId } from '@/carts/domain/types/variant-id.type';

export interface CartItemProps {
  id: CartItemId;
  productId: ProductId;
  productName: string;
  quantity: number;
  unitPrice: Money;
  variantId: VariantId | null;
  sku: string;
  subtotal: Money;
}

export class CartItem {
  private constructor(
    private readonly id: CartItemId,
    private readonly productId: ProductId,
    private readonly productName: string,
    private quantity: number,
    private readonly unitPrice: Money,
    private readonly variantId: VariantId | null,
    private readonly sku: string,
    private subtotal: Money,
  ) {}

  public static create(
    id: CartItemId,
    productId: ProductId,
    productName: string,
    quantity: number,
    unitPrice: Money,
    sku: string,
    variantId?: VariantId,
  ): CartItem {
    CartItem.validateQuantity(quantity);
    CartItem.validateUnitPrice(unitPrice);

    const subtotal = unitPrice.multiply(quantity);

    return new CartItem(
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
  public static reconstitute(props: CartItemProps): CartItem {
    return new CartItem(
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

  // Validations
  private static validateQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new InvalidCartItemQuantityException();
    }
  }

  private static validateUnitPrice(unitPrice: Money): void {
    if (unitPrice.getValue() < 0) {
      throw new InvalidCartAttributeException('Unit price cannot be negative.');
    }
  }

  // Domain Methods
  public changeQuantity(newQuantity: number): void {
    CartItem.validateQuantity(newQuantity);
    this.quantity = newQuantity;
    this.subtotal = this.unitPrice.multiply(newQuantity);
  }

  // Getters
  public getId(): CartItemId {
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
