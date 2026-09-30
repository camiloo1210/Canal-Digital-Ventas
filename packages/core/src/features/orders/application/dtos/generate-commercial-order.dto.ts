export interface GenerateCommercialOrderDto {
  buyerId: string;
  tenantId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}
