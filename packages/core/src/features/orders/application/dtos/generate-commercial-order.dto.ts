export interface GenerateCommercialOrderDto {
  buyerId: string;
  tenantSlug: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}
