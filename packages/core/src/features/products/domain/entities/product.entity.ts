import { Money } from '@/shared/domain/value-objects/money.vo';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { ProductVariant } from "@/products/domain/entities/product-variant.entity";

// TODO: Implement value objects for SKU, money into this entity.
export interface ProductProps {
    id: string;
    name: string;
    price: Money;
    cost: Money;
    wholesalePrice: Money;
    description: string;
    stock: number;
    categoryId: string;
    expirationDate: Date | null;
    status: ProductStatus;
    sku: string;
    tenantId: number;
    seasonIds: string[];
    imagePath: string | null;
    imageUrl: string | null;
    hasVariants: boolean;
    variants: ProductVariant[];
    isVatExempt: boolean;
}

export class Product {
    private constructor(
        private readonly id: string,
        private name: string,
        private price: Money,
        private cost: Money,
        private wholesalePrice: Money,
        private description: string,
        private stock: number,
        private categoryId: string,
        private expirationDate: Date | null,
        private status: ProductStatus,
        private sku: string,
        private readonly tenantId: number,
        private seasonIds: string[],
        private imagePath: string | null,
        private imageUrl: string | null,
        private hasVariants: boolean,
        private variants: ProductVariant[],
        private isVatExempt: boolean
    ) { }

    public static create(
        id: string,
        name: string,
        price: number,
        cost: number,
        description: string,
        stock: number,
        categoryId: string,
        sku: string,
        tenantId: number,
        expirationDate?: Date,
        status?: ProductStatus,
        seasonIds: string[] = [],
        imagePath?: string,
        variants: ProductVariant[] = [],
        isVatExempt: boolean = false,
        wholesalePrice: number = 0
    ): Product {

        Product.validateName(name);
        Product.validateDescription(description);

        if (price <= 0 || cost <= 0) {
            throw new Error('Price and Cost must be positive numbers.');
        }
        if (stock < 0) {
            throw new Error('Stock must be a non-negative integer.');
        }
        if (!categoryId || !sku || !tenantId) {
            throw new Error('Category ID, SKU, and Tenant ID are required.');
        }
        if (expirationDate && expirationDate <= new Date()) {
            throw new Error('Expiration date must be a future date.');
        }


        let initialStatus = status;
        if (!initialStatus) {
            initialStatus = stock === 0 ? ProductStatus.OUT_OF_STOCK : ProductStatus.ACTIVE;
        }

        const hasVariants = variants.length > 0;

        return new Product(
            id,
            name,
            Money.from(price),
            Money.from(cost),
            Money.from(wholesalePrice),
            description,
            stock,
            categoryId,
            expirationDate || null,
            initialStatus,
            sku,
            tenantId,
            seasonIds,
            imagePath || null,
            null,
            hasVariants,
            variants,
            isVatExempt
        );
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
            props.isVatExempt
        );
    }


    private static validateName(name: string): void {
        if (!name || name.length < 2 || name.length > 50) {
            throw new Error('Name must be between 2 and 50 characters long.');
        }
    }

    private static validateDescription(description: string): void {
        if (description && description.length > 200) {
            throw new Error('Description must not exceed 200 characters.');
        }
    }



    public archive(): void {
        if (this.status === ProductStatus.ARCHIVED) {
            throw new Error('Product is already archived.');
        }
        this.status = ProductStatus.ARCHIVED;
    }

    public updateName(newName: string): void {
        Product.validateName(newName);
        this.name = newName;
    }

    public updatePrice(newPrice: Money): void {
        if (newPrice.getValue() <= 0) throw new Error('Price must be positive.');
        this.price = newPrice;
    }

    public updateCost(newCost: Money): void {
        if (newCost.getValue() <= 0) throw new Error('Cost must be positive.');
        this.cost = newCost;
    }

    public updateWholesalePrice(newPrice: Money): void {
        if (newPrice.getValue() < 0) throw new Error('Wholesale price cannot be negative.');
        this.wholesalePrice = newPrice;
    }

    public updateDescription(newDescription: string): void {
        Product.validateDescription(newDescription);
        this.description = newDescription;
    }

    public updateStock(newStock: number): void {
        if (newStock < 0) {
            throw new Error('Stock must be a non-negative integer.');
        }
        this.stock = newStock;


        if (this.stock === 0 && this.status === ProductStatus.ACTIVE) {
            this.status = ProductStatus.OUT_OF_STOCK;
        } else if (this.stock > 0 && this.status === ProductStatus.OUT_OF_STOCK) {
            this.status = ProductStatus.ACTIVE;
        }
    }

    public updateCategory(newCategoryId: string): void {
        if (!newCategoryId) throw new Error('Category ID must be provided.');
        this.categoryId = newCategoryId;
    }

    public updateExpirationDate(newDate: Date): void {
        if (newDate <= new Date()) throw new Error('Expiration date must be in the future.');
        this.expirationDate = newDate;
    }

    public updateStatus(newStatus: ProductStatus): void {

        this.status = newStatus;
    }

    public updateSeasons(newSeasonIds: string[]): void {
        this.seasonIds = newSeasonIds;
    }

    public updateImagePath(newPath: string | null): void {
        this.imagePath = newPath;
    }

    public updateImageUrl(newUrl: string | null): void {
        this.imageUrl = newUrl;
    }

    public updateIsVatExempt(isExempt: boolean): void {
        this.isVatExempt = isExempt;
    }


    public setVariants(variants: ProductVariant[]): void {
        this.variants = variants;
        this.hasVariants = variants.length > 0;
    }



    public getId(): string { return this.id; }
    public getName(): string { return this.name; }
    public getPrice(): Money { return this.price; }
    public getCost(): Money { return this.cost; }
    public getWholesalePrice(): Money { return this.wholesalePrice; }
    public getDescription(): string { return this.description; }
    public getStock(): number { return this.stock; }
    public getCategory(): string { return this.categoryId; }
    public getExpirationDate(): Date | null { return this.expirationDate; }
    public getStatus(): ProductStatus { return this.status; }
    public getSku(): string { return this.sku; }
    public getTenantId(): number { return this.tenantId; }
    public getSeasonIds(): string[] { return [...this.seasonIds]; }
    public getImagePath(): string | null { return this.imagePath; }
    public getImageUrl(): string | null { return this.imageUrl; }
    public getHasVariants(): boolean { return this.hasVariants; }
    public getVariants(): ProductVariant[] { return [...this.variants]; }
    public getIsVatExempt(): boolean { return this.isVatExempt; }
}