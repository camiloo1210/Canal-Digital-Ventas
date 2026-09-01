import { Money } from '@/shared/domain/value-objects/money.vo';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { VariantId, createVariantId } from '@/products/domain/types/variant-id.type';
import { ProductId, createProductId } from '@/products/domain/types/product-id.type';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
import { InvalidProductStateException } from '@/products/domain/exceptions/invalid-product-state.exception';

export interface ProductVariantProps {
  id: VariantId;
  productId: ProductId;
  sku: Sku;
  name: ProductName;
  attributes: Record<string, string>;
  priceOverride: Money | null;
  stock: number;
  status: ProductStatus;
}

export class ProductVariant {
  private constructor(
    private readonly id: VariantId,
    private readonly productId: ProductId,
    private sku: Sku,
    private name: ProductName,
    private attributes: Record<string, string>,
    private priceOverride: Money | null,
    private stock: number,
    private status: ProductStatus,
  ) {}

  public static create(
    id: VariantId,
    productId: ProductId,
    sku: Sku,
    name: ProductName,
    attributes: Record<string, string>,
    stock: number,
    priceOverride?: Money,
    status?: ProductStatus,
  ): ProductVariant {
    if (!id || !productId || !sku) {
      throw new InvalidProductAttributeException('Variant ID, Product ID, and SKU are required.');
    }
    if (stock < 0) {
      throw new InvalidProductAttributeException('Variant stock cannot be negative.');
    }

    let initialStatus = status;
    if (!initialStatus) {
      initialStatus = stock === 0 ? ProductStatus.OUT_OF_STOCK : ProductStatus.ACTIVE;
    }

    return new ProductVariant(
      id,
      productId,
      sku,
      name,
      attributes,
      priceOverride || null,
      stock,
      initialStatus,
    );
  }

  public static reconstitute(props: ProductVariantProps): ProductVariant {
    return new ProductVariant(
      props.id,
      props.productId,
      props.sku,
      props.name,
      props.attributes,
      props.priceOverride,
      props.stock,
      props.status,
    );
  }

  public updateStock(newStock: number): void {
    if (newStock < 0) throw new InvalidProductAttributeException('Stock cannot be negative.');
    this.stock = newStock;

    if (this.stock === 0 && this.status === ProductStatus.ACTIVE) {
      this.status = ProductStatus.OUT_OF_STOCK;
    } else if (this.stock > 0 && this.status === ProductStatus.OUT_OF_STOCK) {
      this.status = ProductStatus.ACTIVE;
    }
  }

  public updatePriceOverride(newPrice: Money | null): void {
    if (newPrice && newPrice.getValue() <= 0) {
      throw new InvalidProductAttributeException('Price override must be positive.');
    }
    this.priceOverride = newPrice;
  }

  public updateAttributes(newAttributes: Record<string, string>): void {
    this.attributes = newAttributes;
  }

  public archive(): void {
    if (this.status === ProductStatus.ARCHIVED) {
      throw new InvalidProductStateException('Variant is already archived.');
    }
    this.status = ProductStatus.ARCHIVED;
  }

  public getId(): VariantId {
    return this.id;
  }
  public getProductId(): ProductId {
    return this.productId;
  }
  public getSku(): string {
    return this.sku.getValue();
  }
  public getName(): string {
    return this.name.getValue();
  }
  public getAttributes(): Record<string, string> {
    return { ...this.attributes };
  }
  public getPriceOverride(): Money | null {
    return this.priceOverride;
  }
  public getStock(): number {
    return this.stock;
  }
  public getStatus(): ProductStatus {
    return this.status;
  }
}
