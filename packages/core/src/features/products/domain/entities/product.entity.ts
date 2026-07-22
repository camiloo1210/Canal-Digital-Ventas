import { Money } from '@/shared/domain/value-objects/money.vo';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { ProductVariant } from "@/products/domain/entities/product-variant.entity";
import { Sku } from "@/products/domain/value-objects/sku.vo";
import { ProductName } from "@/products/domain/value-objects/product-name.vo";

export interface ProductProps {
    id: string;
    name: ProductName;
    price: Money;
    cost: Money;
    wholesalePrice: Money;
    description: string;
    stock: number;
    categoryId: string;
    expirationDate: Date | null;
    status: ProductStatus;
    sku: Sku;
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
        private name: ProductName,
        private price: Money,
        private cost: Money,
        private wholesalePrice: Money,
        private description: string,
        private stock: number,
        private categoryId: string,
        private expirationDate: Date | null,
        private status: ProductStatus,
        private sku: Sku,
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
        name: ProductName,
        price: Money,
        cost: Money,
        description: string,
        stock: number,
        categoryId: string,
        sku: Sku,
        tenantId: number,
        expirationDate?: Date,
        status?: ProductStatus,
        seasonIds: string[] = [],
        imagePath?: string,
        variants: ProductVariant[] = [],
        isVatExempt: boolean = false,
        wholesalePrice?: Money
    ): Product {

        Product.validateDescription(description);

        if (stock < 0) {
            throw new Error('Stock must be a non-negative integer.');
        }
        if (!categoryId || !tenantId) {
            throw new Error('Category ID and Tenant ID are required.');
        }
        if (expirationDate && expirationDate <= new Date()) {
            throw new Error('Expiration date must be a future date.');
        }

        let initialStatus = status;
        if (!initialStatus) {
            initialStatus = stock === 0 ? ProductStatus.OUT_OF_STOCK : ProductStatus.ACTIVE;
        }

        const hasVariants = variants.length > 0;

        const finalWholesalePrice = wholesalePrice ?? Money.from(0, price.getCurrency());

        return new Product(
            id,
            name,
            price,
            cost,
            finalWholesalePrice,
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
            props.id, props.name, props.price, props.cost, props.wholesalePrice,
            props.description, props.stock, props.categoryId, props.expirationDate,
            props.status, props.sku, props.tenantId, props.seasonIds,
            props.imagePath, props.imageUrl, props.hasVariants, props.variants, props.isVatExempt
        );
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
        this.name = ProductName.from(newName);
    }

    public updatePrice(newPrice: Money): void {
        this.price = newPrice;
    }

    public updateCost(newCost: Money): void {
        this.cost = newCost;
    }

    public updateWholesalePrice(newPrice: Money): void {
        this.wholesalePrice = newPrice;
    }

    public updateDescription(newDescription: string): void {
        Product.validateDescription(newDescription);
        this.description = newDescription;
    }

    public updateStock(newStock: number): void {
        if (newStock < 0) throw new Error('Stock must be a non-negative integer.');
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
    public getName(): string { return this.name.getValue(); }
    public getPrice(): Money { return this.price; }
    public getCost(): Money { return this.cost; }
    public getWholesalePrice(): Money { return this.wholesalePrice; }
    public getDescription(): string { return this.description; }
    public getStock(): number { return this.stock; }
    public getCategory(): string { return this.categoryId; }
    public getExpirationDate(): Date | null { return this.expirationDate; }
    public getStatus(): ProductStatus { return this.status; }
    public getSku(): string { return this.sku.getValue(); }
    public getTenantId(): number { return this.tenantId; }
    public getSeasonIds(): string[] { return [...this.seasonIds]; }
    public getImagePath(): string | null { return this.imagePath; }
    public getImageUrl(): string | null { return this.imageUrl; }
    public getHasVariants(): boolean { return this.hasVariants; }
    public getVariants(): ProductVariant[] { return [...this.variants]; }
    public getIsVatExempt(): boolean { return this.isVatExempt; }
}