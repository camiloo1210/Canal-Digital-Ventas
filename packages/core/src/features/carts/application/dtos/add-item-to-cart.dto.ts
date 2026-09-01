export interface AddItemToCartDto {
  cartId: string;
  tenantId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceValue: number;
  variantId?: string;
}
