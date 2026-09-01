export interface UpdateProductImagesDto {
  productId: string;
  tenantId: string;
  imagePath: string | null;
  imageUrl: string | null;
}
