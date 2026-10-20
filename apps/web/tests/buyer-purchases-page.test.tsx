import { beforeEach, describe, expect, it, vi } from 'vitest';
import BuyerPurchasesPage from '@/app/purchases/page';

const mocks = vi.hoisted(
  (): { getUser: ReturnType<typeof vi.fn>; findOrders: ReturnType<typeof vi.fn> } => ({
    getUser: vi.fn(),
    findOrders: vi.fn(),
  }),
);
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('next/navigation', (): object => ({
  redirect: (path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock('@/features/orders/di/orders.di', (): object => ({
  ordersDi: {
    resolveBuyerOrderReadRepository: (): object => ({ findOrdersByBuyerId: mocks.findOrders }),
  },
}));
vi.mock('@/features/store/queries/store-viewer.query', (): object => ({
  getStoreViewerQuery: async (): Promise<object> => ({ isAuthenticated: true }),
}));
vi.mock('@/features/store-directory/components/buyer-shell', (): object => ({
  BuyerShell: (): null => null,
}));
vi.mock('@/features/orders/components/buyer-orders-list', (): object => ({
  BuyerOrdersList: (): null => null,
}));

describe('buyer purchases route', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.findOrders.mockResolvedValue([]);
  });
  it('requires authentication before querying private orders', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(BuyerPurchasesPage()).rejects.toThrow('REDIRECT:/login?redirectTo=%2Fpurchases');
    expect(mocks.findOrders).not.toHaveBeenCalled();
  });
  it('scopes the read to the authenticated buyer', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'authenticated-buyer' } } });
    await BuyerPurchasesPage();
    expect(mocks.findOrders).toHaveBeenCalledExactlyOnceWith('authenticated-buyer');
  });
});
