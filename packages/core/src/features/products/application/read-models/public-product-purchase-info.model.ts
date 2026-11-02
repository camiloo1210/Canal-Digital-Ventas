export interface PublicProductPurchaseInfoReadModel {
  galleryUrls: string[];
  /** Units a buyer can add to the cart right now (never negative). */
  availableQuantity: number;
}
