export interface BuyerCartItemReadModel {
  productId: string;
  name: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  /** Currently purchasable units, capped at MAX_LINE_QUANTITY. */
  maxQuantity: number;
  imageUrl: string | null;
}

export interface BuyerCartReadModel {
  items: BuyerCartItemReadModel[];
  version: number;
  updatedAt: string;
  expiresAt: string;
}

export type BuyerCartDropReason = 'unavailable' | 'out_of_stock' | 'limit';

export interface BuyerCartDroppedItem {
  productId: string;
  reason: BuyerCartDropReason;
}

export interface BuyerCartSyncResult {
  cart: BuyerCartReadModel;
  dropped: BuyerCartDroppedItem[];
}
