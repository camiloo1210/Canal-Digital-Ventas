import 'server-only';

import { ordersDi } from '@/features/orders/di/orders.di';
import { invalidatePublicCatalog } from '@/lib/cache/public-catalog-cache';

export async function invalidateBuyerOrderCatalog(buyerId: string, orderId: string): Promise<void> {
  try {
    const orders = await ordersDi.resolveBuyerOrderReadRepository().findOrdersByBuyerId(buyerId);
    const order = orders.find((candidate): boolean => candidate.id === orderId);
    if (order) await invalidatePublicCatalog(order.tenantSlug);
  } catch {
    // Invalidation is best-effort; entries still expire by TTL.
  }
}
