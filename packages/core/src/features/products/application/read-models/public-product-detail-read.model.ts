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
}
