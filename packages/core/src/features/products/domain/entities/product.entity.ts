import { Money } from '@/shared/domain/value-objects/money.vo';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { ProductVariant } from '@/products/domain/entities/product-variant.entity';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { ProductId } from '@/products/domain/types/product-id.type';
import { CategoryId } from '@/products/domain/types/category-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
import { InvalidProductStateException } from '@/products/domain/exceptions/invalid-product-state.exception';
import { ProductCreatedEvent } from '@/products/domain/events/product-created.event';
import { ProductArchivedEvent } from '@/products/domain/events/product-archived.event';
import { ProductDetailsChangedEvent } from '@/products/domain/events/product-details-changed.event';
import { ProductPricingChangedEvent } from '@/products/domain/events/product-pricing-changed.event';
import { ProductStockAdjustedEvent } from '@/products/domain/events/product-stock-adjusted.event';

export interface ProductProps {
  id: ProductId;
  name: ProductName;
  price: Money;
  cost: Money;
  wholesalePrice: Money;
  description: string;
  stock: number;
  categoryId: CategoryId;
  expirationDate: Date | null;
  status: ProductStatus;
  sku: Sku;
  tenantId: TenantId;
  seasonIds: string[];
  imagePath: string | null;
  imageUrl: string | null;
  hasVariants: boolean;
  variants: ProductVariant[];
  isVatExempt: boolean;
  updatedAt: Date;
  version: number;
}

export class Product {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: ProductId,
    private name: ProductName,
    private price: Money,
    private cost: Money,
    private wholesalePrice: Money,
    private description: string,
    private stock: number,
    private categoryId: CategoryId,
    private expirationDate: Date | null,
    private status: ProductStatus,
    private sku: Sku,
    private readonly tenantId: TenantId,
    private seasonIds: string[],
    private imagePath: string | null,
    private imageUrl: string | null,
    private hasVariants: boolean,
    private variants: ProductVariant[],
    private isVatExempt: boolean,
    private updatedAt: Date,
    private version: number,
  ) {}

  public static create(
    id: ProductId,
    name: ProductName,
    price: Money,
    cost: Money,
    description: string,
    stock: number,
    categoryId: CategoryId,
    sku: Sku,
    tenantId: TenantId,
    expirationDate: Date | null,
    status: ProductStatus | null,
    seasonIds: string[],
    imagePath: string | null,
    variants: ProductVariant[],
    isVatExempt: boolean,
    wholesalePrice: Money | null,
  ): Product {
    Product.validateId(id);
    Product.validateCategoryId(categoryId);
    Product.validateTenantId(tenantId);
    Product.validateStock(stock);
    Product.validateDescription(description);
    if (expirationDate) {
      Product.validateExpirationDate(expirationDate);
    }

    const initialStatus =
      status || (stock === 0 ? ProductStatus.OUT_OF_STOCK : ProductStatus.ACTIVE);
    const hasVariants = variants.length > 0;
    const finalWholesalePrice = wholesalePrice ?? Money.from(0, price.getCurrency());

    const product = new Product(
      id,
      name,
      price,
      cost,
      finalWholesalePrice,
      description,
      stock,
      categoryId,
      expirationDate,
      initialStatus,
      sku,
      tenantId,
      seasonIds,
      imagePath,
      null,
      hasVariants,
      variants,
      isVatExempt,
      new Date(),
      0, // Initial version
    );

    product.addDomainEvent(new ProductCreatedEvent(id));
    return product;
  }

  public static reconstitute(props: ProductProps): Product {
    return new Product(
      props.id,
      props.name,
      props.price,
      props.cost,
      props.wholesalePrice,
      props.description,
      props.stock,
      props.categoryId,
      props.expirationDate,
      props.status,
      props.sku,
      props.tenantId,
      props.seasonIds,
      props.imagePath,
      props.imageUrl,
      props.hasVariants,
      props.variants,
      props.isVatExempt,
      props.updatedAt,
      props.version,
    );
  }

  // Validations
  private static validateId(id: ProductId): void {
    if (!id || id.trim().length === 0)
      throw new InvalidProductAttributeException('Product ID is required.');
  }
  private static validateCategoryId(categoryId: CategoryId): void {
    if (!categoryId || categoryId.trim().length === 0)
      throw new InvalidProductAttributeException('Category ID is required.');
  }
  private static validateTenantId(tenantId: TenantId): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new InvalidProductAttributeException(
        'Tenant ID is required and must be a valid string.',
      );
    }
  }
  private static validateStock(stock: number): void {
    if (stock < 0)
      throw new InvalidProductAttributeException('Stock must be a non-negative integer.');
  }
  private static validateDescription(description: string): void {
    if (description && description.length > 200) {
      throw new InvalidProductAttributeException('Description must not exceed 200 characters.');
    }
  }
  private static validateExpirationDate(date: Date): void {
    if (date <= new Date())
      throw new InvalidProductAttributeException('Expiration date must be a future date.');
  }

  // Business Actions
  public archive(): void {
    if (this.status === ProductStatus.ARCHIVED) {
      throw new InvalidProductStateException('Product is already archived.');
    }
    this.status = ProductStatus.ARCHIVED;
    this.addDomainEvent(new ProductArchivedEvent(this.id));
    this.updateUpdatedAt();
  }

  private updateUpdatedAt(): void {
    this.updatedAt = new Date();
    this.version++;
  }

  public changeDetails(
    name: ProductName,
    description: string,
    categoryId: CategoryId,
    sku: Sku,
    seasonIds: string[],
    isVatExempt: boolean,
  ): void {
    Product.validateDescription(description);
    Product.validateCategoryId(categoryId);
    this.name = name;
    this.description = description;
    this.categoryId = categoryId;
    this.sku = sku;
    this.seasonIds = seasonIds;
    this.isVatExempt = isVatExempt;
    this.addDomainEvent(new ProductDetailsChangedEvent(this.id));
    this.updateUpdatedAt();
  }

  public changePricing(price: Money, cost: Money, wholesalePrice: Money): void {
    if (wholesalePrice.getValue() < 0) {
      throw new InvalidProductAttributeException('Wholesale price cannot be negative.');
    }
    this.price = price;
    this.cost = cost;
    this.wholesalePrice = wholesalePrice;
    this.addDomainEvent(new ProductPricingChangedEvent(this.id));
    this.updateUpdatedAt();
  }

  public adjustStock(newStock: number): void {
    Product.validateStock(newStock);
    this.stock = newStock;
    if (this.stock === 0 && this.status === ProductStatus.ACTIVE) {
      this.status = ProductStatus.OUT_OF_STOCK;
    } else if (this.stock > 0 && this.status === ProductStatus.OUT_OF_STOCK) {
      this.status = ProductStatus.ACTIVE;
    }
    this.addDomainEvent(new ProductStockAdjustedEvent(this.id, this.stock));
    this.updateUpdatedAt();
  }

  public changeExpirationDate(newDate: Date | null): void {
    if (newDate) Product.validateExpirationDate(newDate);
    this.expirationDate = newDate;
    this.updateUpdatedAt();
  }

  public changeStatus(newStatus: ProductStatus): void {
    this.status = newStatus;
    this.updateUpdatedAt();
  }

  public updateImages(imagePath: string | null, imageUrl: string | null): void {
    this.imagePath = imagePath;
    this.imageUrl = imageUrl;
    this.updateUpdatedAt();
  }

  public setVariants(variants: ProductVariant[]): void {
    this.variants = variants;
    this.hasVariants = variants.length > 0;
    this.updateUpdatedAt();
  }

  // Domain Events Management
  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }
  public get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }
  public clearDomainEvents(): void {
    this._domainEvents.length = 0;
  }

  // Getters
  public getId(): ProductId {
    return this.id;
  }
  public getName(): string {
    return this.name.getValue();
  }
  public getPrice(): Money {
    return this.price;
  }
  public getCost(): Money {
    return this.cost;
  }
  public getWholesalePrice(): Money {
    return this.wholesalePrice;
  }
  public getDescription(): string {
    return this.description;
  }
  public getStock(): number {
    return this.stock;
  }
  public getCategory(): CategoryId {
    return this.categoryId;
  }
  public getExpirationDate(): Date | null {
    return this.expirationDate;
  }
  public getStatus(): ProductStatus {
    return this.status;
  }
  public getSku(): string {
    return this.sku.getValue();
  }
  public getTenantId(): TenantId {
    return this.tenantId;
  }
  public getSeasonIds(): string[] {
    return [...this.seasonIds];
  }
  public getImagePath(): string | null {
    return this.imagePath;
  }
  public getImageUrl(): string | null {
    return this.imageUrl;
  }
  public getHasVariants(): boolean {
    return this.hasVariants;
  }
  public getVariants(): ProductVariant[] {
    return [...this.variants];
  }
  public getIsVatExempt(): boolean {
    return this.isVatExempt;
  }
  public isWholesale(): boolean {
    return this.wholesalePrice.getValue() > 0;
  }
  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
  public getVersion(): number {
    return this.version;
  }
}
