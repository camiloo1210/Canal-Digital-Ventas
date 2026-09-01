export interface ChangeProductPricingDto {
  productId: string;
  tenantId: string;
  price: number;
  cost: number;
  wholesalePrice?: number | null;
}
