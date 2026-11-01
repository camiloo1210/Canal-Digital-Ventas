import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateBuyerOrderCatalog } from '@/features/orders/utils/invalidate-order-catalog';
import { ordersDi } from '@/features/orders/di/orders.di';
import { invalidatePublicCatalog } from '@/lib/cache/public-catalog-cache';

vi.mock('server-only', (): object => ({}));
vi.mock('@/features/orders/di/orders.di', (): object => ({
  ordersDi: { resolveBuyerOrderReadRepository: vi.fn() },
}));
vi.mock('@/lib/cache/public-catalog-cache', (): object => ({
  invalidatePublicCatalog: vi.fn(),
}));

function readOrders(orders: Array<{ id: string; tenantSlug: string }>): void {
  vi.mocked(ordersDi.resolveBuyerOrderReadRepository).mockReturnValue({
    findOrdersByBuyerId: vi.fn().mockResolvedValue(orders),
  } as unknown as ReturnType<typeof ordersDi.resolveBuyerOrderReadRepository>);
}

describe('invalidateBuyerOrderCatalog', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('invalidates only the store that owns the cancelled order', async (): Promise<void> => {
    readOrders([
      { id: 'order-a', tenantSlug: 'store-a' },
      { id: 'order-b', tenantSlug: 'store-b' },
    ]);
    await invalidateBuyerOrderCatalog('buyer', 'order-b');
    expect(invalidatePublicCatalog).toHaveBeenCalledOnce();
    expect(invalidatePublicCatalog).toHaveBeenCalledWith('store-b');
  });

  it('does nothing when the order is not among the buyer orders', async (): Promise<void> => {
    readOrders([{ id: 'order-a', tenantSlug: 'store-a' }]);
    await invalidateBuyerOrderCatalog('buyer', 'missing');
    expect(invalidatePublicCatalog).not.toHaveBeenCalled();
  });

  it('never throws when the read fails', async (): Promise<void> => {
    vi.mocked(ordersDi.resolveBuyerOrderReadRepository).mockImplementation((): never => {
      throw new Error('database unavailable');
    });
    await expect(invalidateBuyerOrderCatalog('buyer', 'order-a')).resolves.toBeUndefined();
  });
});
