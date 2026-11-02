/** Server-side buyer carts slide their expiry on every successful write. */
export const BUYER_CART_TTL_DAYS = 30;
export const MAX_CART_LINES = 50;
export const MAX_LINE_QUANTITY = 99;
/** Upper bound of distinct products inspected per snapshot; the rest is reported as `limit`. */
export const MAX_SNAPSHOT_CANDIDATES = 200;

const MS_PER_DAY = 86_400_000;

export function buyerCartExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + BUYER_CART_TTL_DAYS * MS_PER_DAY);
}
