export interface SetProductVariantsDto {
  productId: string;
  tenantId: string;
  variants: {
    id: string;
    sku: string;
    name: string;
    attributes: Record<string, string>;
    stock: number;
    priceOverride?: number;
    status?: string;
  }[];
}
