export interface BuyerCartCatalogProduct {
  productId: string;
  name: string;
  sku: string;
  unitPriceCents: number;
  currency: string;
  wholesalePriceCents: number | null;
  wholesaleMinQuantity: number | null;
  /** Units purchasable right now (never negative), straight from stock. */
  availableQuantity: number;
  imageUrl: string | null;
}

export interface BuyerCartCatalogReadPort {
  findActiveTenantIdBySlug(tenantSlug: string): Promise<string | null>;

  /** Active, storefront-visible products of the tenant among `productIds`; others are omitted. */
  findProducts(tenantId: string, productIds: string[]): Promise<BuyerCartCatalogProduct[]>;
}
