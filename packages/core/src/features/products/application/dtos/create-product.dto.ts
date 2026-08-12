export interface CreateProductDto {
  id: string;
  name: string;
  price: number;
  cost: number;
  wholesalePrice?: number;
  description: string;
  stock: number;
  categoryId: string;
  sku: string;
  tenantId: number;
  seasonIds?: string[];
  isVatExempt?: boolean;
  image?: any;
}
