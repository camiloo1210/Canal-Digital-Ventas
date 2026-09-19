export interface UpdateProductDto {
  productId: string;
  tenantId: string;
  expectedVersion: number;
  name: string;
  sku: string;
  price: number;
  cost: number;
  wholesalePrice: number | null;
  categoryId: string;
  description?: string;
  stock?: number;
  isVatExempt: boolean;
  seasonIds: string[];
}
