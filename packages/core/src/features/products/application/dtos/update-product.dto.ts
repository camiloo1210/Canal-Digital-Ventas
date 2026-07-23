export interface UpdateProductDto {
    id: string;
    name?: string;
    price?: number;
    cost?: number;
    wholesalePrice?: number;
    description?: string;
    stock?: number;
    categoryId?: string;
    sku?: string;
    seasonIds?: string[];
    isVatExempt?: boolean;
    status?: string;
    expirationDate?: string;
    imagePath?: string;
    imageUrl?: string;
    hasVariants?: boolean;
    variants?: any[];
}