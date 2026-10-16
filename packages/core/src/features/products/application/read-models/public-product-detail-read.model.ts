import { PublicStockAvailability } from '@/products/application/read-models/public-product-read.model';

export interface PublicProductDetailReadModel {
  id: string;
  name: string;
  priceCents: number;
  description: string;
  categoryId: string | null;
  sku: string;
  imageUrl: string | null;
  hasVariants: boolean;
  inStock: boolean;
  stockAvailability: PublicStockAvailability;
  wholesalePriceCents: number | null;
  wholesaleMinQuantity: number | null;
}
