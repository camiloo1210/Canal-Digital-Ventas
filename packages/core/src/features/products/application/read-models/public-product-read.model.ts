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
}
