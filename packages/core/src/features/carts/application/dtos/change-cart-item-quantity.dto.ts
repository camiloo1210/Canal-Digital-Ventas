export interface ChangeCartItemQuantityDto {
  cartId: string;
  tenantId: string;
  itemId: string;
  quantity: number;
}
