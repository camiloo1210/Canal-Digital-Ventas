export interface CreateProductDto {
  id: string;
  name: string;
  price: number;
  cost: number;
  wholesalePrice: number | null;
  description: string;
  stock: number;
  categoryId: string;
  sku: string;
  tenantId: string;
  seasonIds: string[];
  isVatExempt: boolean;
  image: unknown | null;
}
