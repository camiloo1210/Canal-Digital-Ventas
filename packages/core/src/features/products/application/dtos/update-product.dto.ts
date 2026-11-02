export interface UpdateProductDto {
  productId: string;
  tenantId: string;
  expectedVersion: number;
  name: string;
  sku: string;
  price: number;
  cost: number;
  wholesalePrice: number | null;
  wholesaleMinQuantity: number | null;
  categoryId: string;
  description?: string;
  stock?: number;
  isVatExempt: boolean;
  seasonIds: string[];
  imagePath?: string;
  imageUrl?: string;
  gallery?: {
    /** URLs the seller wants to keep; null keeps the current gallery untouched. */
    retainedUrls: string[] | null;
    addedUrls: string[];
  };
}
