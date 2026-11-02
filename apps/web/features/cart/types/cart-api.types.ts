/**
 * Serializable shapes exchanged with /api/store/cart. They mirror the read models exported by
 * the core (BuyerCartReadModel / BuyerCartSyncResult) so client code never imports the core.
 */
export interface CartApiItem {
  productId: string;
  name: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  maxQuantity: number;
  imageUrl: string | null;
}

export interface CartApiCart {
  items: CartApiItem[];
  version: number;
  updatedAt: string;
  expiresAt: string;
}

export type CartDropReason = 'unavailable' | 'out_of_stock' | 'limit';

export interface CartApiDropped {
  productId: string;
  reason: CartDropReason;
}

export interface CartApiSyncResult {
  cart: CartApiCart;
  dropped: CartApiDropped[];
}

export interface CartLineInput {
  productId: string;
  quantity: number;
}
