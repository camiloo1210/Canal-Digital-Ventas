import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  MAX_SNAPSHOT_CANDIDATES,
} from '@/carts/domain/policies/buyer-cart-limits';
import type { BuyerCartCatalogProduct } from '@/carts/application/ports/out/buyer-cart-catalog-read.port';
import type {
  BuyerCartDroppedItem,
  BuyerCartItemReadModel,
} from '@/carts/application/read-models/buyer-cart.read-model';
import type { BuyerCartStoredLine } from '@/carts/application/ports/out/buyer-cart-repository.port';

export interface CartLineCandidate {
  productId: string;
  quantity: number;
}

export interface NormalizedBuyerCart {
  items: BuyerCartItemReadModel[];
  dropped: BuyerCartDroppedItem[];
}

function sanitizeQuantity(quantity: number): number {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return 1;
  return Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.trunc(quantity)));
}

/** Dedupes by product id keeping the first position and the highest requested quantity. */
export function dedupeCandidates(candidates: readonly CartLineCandidate[]): CartLineCandidate[] {
  const byId = new Map<string, CartLineCandidate>();
  for (const candidate of candidates) {
    const quantity = sanitizeQuantity(candidate.quantity);
    const existing = byId.get(candidate.productId);
    if (existing) existing.quantity = Math.max(existing.quantity, quantity);
    else byId.set(candidate.productId, { productId: candidate.productId, quantity });
  }
  return [...byId.values()];
}

/** Ids worth looking up in the catalog; the remainder is reported as `limit`. */
export function lookupIds(deduped: readonly CartLineCandidate[]): string[] {
  return deduped
    .slice(0, MAX_SNAPSHOT_CANDIDATES)
    .map((candidate: CartLineCandidate): string => candidate.productId);
}

/**
 * Applies the server-side cart rules to an already deduplicated snapshot. Names, SKUs and prices
 * always come from the catalog; quantities are clamped to 1..MAX_LINE_QUANTITY and to stock.
 */
export function normalizeBuyerCart(
  deduped: readonly CartLineCandidate[],
  catalog: ReadonlyMap<string, BuyerCartCatalogProduct>,
): NormalizedBuyerCart {
  const items: BuyerCartItemReadModel[] = [];
  const dropped: BuyerCartDroppedItem[] = [];
  deduped.forEach((candidate: CartLineCandidate, index: number): void => {
    if (index >= MAX_SNAPSHOT_CANDIDATES) {
      dropped.push({ productId: candidate.productId, reason: 'limit' });
      return;
    }
    const product = catalog.get(candidate.productId);
    if (!product) {
      dropped.push({ productId: candidate.productId, reason: 'unavailable' });
      return;
    }
    const available = Math.max(0, Math.trunc(product.availableQuantity));
    if (available === 0) {
      dropped.push({ productId: candidate.productId, reason: 'out_of_stock' });
      return;
    }
    if (items.length >= MAX_CART_LINES) {
      dropped.push({ productId: candidate.productId, reason: 'limit' });
      return;
    }
    const maxQuantity = Math.min(available, MAX_LINE_QUANTITY);
    items.push({
      productId: product.productId,
      name: product.name,
      sku: product.sku,
      unitPriceCents: product.unitPriceCents,
      quantity: Math.min(sanitizeQuantity(candidate.quantity), maxQuantity),
      maxQuantity,
      imageUrl: product.imageUrl,
    });
  });
  return { items, dropped };
}

export function toStoredLines(items: readonly BuyerCartItemReadModel[]): BuyerCartStoredLine[] {
  return items.map((item: BuyerCartItemReadModel): BuyerCartStoredLine => ({
    productId: item.productId,
    name: item.name,
    sku: item.sku,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
  }));
}

export function sameStoredLines(
  left: readonly BuyerCartStoredLine[],
  right: readonly BuyerCartStoredLine[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (line: BuyerCartStoredLine, index: number): boolean =>
        line.productId === right[index].productId &&
        line.quantity === right[index].quantity &&
        line.name === right[index].name &&
        line.sku === right[index].sku &&
        line.unitPriceCents === right[index].unitPriceCents,
    )
  );
}

export function catalogMap(
  products: readonly BuyerCartCatalogProduct[],
): Map<string, BuyerCartCatalogProduct> {
  return new Map(
    products.map((product: BuyerCartCatalogProduct): [string, BuyerCartCatalogProduct] => [
      product.productId,
      product,
    ]),
  );
}
