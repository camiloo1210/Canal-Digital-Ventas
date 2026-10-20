import type { ProductStatus } from '@/products/domain/enums/product-status.enum';

export interface ProductReadModel {
  id: string;
  name: string;
  price_cents: number;
  cost_cents: number;
  wholesale_price_cents: number | null;
  wholesale_min_quantity: number | null;
  description: string | null;
  stock: number;
  category_id: string;
  sku: string;
  status: ProductStatus;
  tenant_id: string;
  is_vat_exempt: boolean;
  version: number;
  image_url: string | null;
}
