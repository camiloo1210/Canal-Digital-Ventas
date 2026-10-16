export const LOW_STOCK_THRESHOLD = 10;

export function isLowStock(stock: number): boolean {
  return Number.isSafeInteger(stock) && stock >= 0 && stock <= LOW_STOCK_THRESHOLD;
}
