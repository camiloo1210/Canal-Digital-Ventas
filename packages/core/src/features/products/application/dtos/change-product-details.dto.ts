export interface ChangeProductDetailsDto {
  productId: string;
  tenantId: string;
  name: string;
  description: string;
  categoryId: string;
  sku: string;
  seasonIds: string[];
  isVatExempt: boolean;
}
