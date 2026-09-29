export type PublicStockAvailability =
  | 'AVAILABLE'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'CHECK_AVAILABILITY';

export interface PublicProductReadModel {
  id: string;
  name: string;
  priceCents: number;
  description: string;
  categoryId: string;
  sku: string;
  imageUrl: string | null;
  hasVariants: boolean;
  inStock: boolean;
  stockAvailability: PublicStockAvailability;
}
