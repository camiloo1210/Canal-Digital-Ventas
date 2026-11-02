export interface BuyerCartItemInputDto {
  productId: string;
  quantity: number;
}

export interface GetBuyerCartDto {
  userId: string;
  tenantSlug: string;
}

export interface SyncBuyerCartDto {
  userId: string;
  tenantSlug: string;
  items: BuyerCartItemInputDto[];
  baseVersion: number | null;
}

export interface MergeBuyerCartDto {
  userId: string;
  tenantSlug: string;
  items: BuyerCartItemInputDto[];
}

export interface CompleteBuyerCartDto {
  userId: string;
  tenantId: string;
}
