import { beforeEach, describe, expect, it, vi } from 'vitest';
import BuyerPurchaseDetailsPage from '@/app/purchases/[orderId]/page';
const mocks = vi.hoisted(
  (): {
    getUser: ReturnType<typeof vi.fn>;
    findOrders: ReturnType<typeof vi.fn>;
    findTracking: ReturnType<typeof vi.fn>;
  } => ({
    getUser: vi.fn(),
    findOrders: vi.fn(),
    findTracking: vi.fn(),
  }),
);
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('next/navigation', (): object => ({
  redirect: (path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: (): never => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('@/features/orders/di/orders.di', (): object => ({
  ordersDi: {
    resolveBuyerOrderReadRepository: (): object => ({ findOrderByBuyerId: mocks.findOrders }),
    resolveBuyerTracking: (): object => ({
      repository: { findByBuyer: mocks.findTracking },
      deploymentId: 'sandbox',
    }),
  },
}));
vi.mock('@/features/store/queries/store-viewer.query', (): object => ({
  getStoreViewerQuery: async (): Promise<object> => ({ isAuthenticated: true }),
}));
vi.mock('@/features/store-directory/components/buyer-shell', (): object => ({
  BuyerShell: (): null => null,
}));
vi.mock('@/features/orders/components/buyer-order-card', (): object => ({
  BuyerOrderCard: (): null => null,
}));
const orderId = '550e8400-e29b-41d4-a716-446655440000';
describe('private purchase details', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.findOrders.mockResolvedValue(null);
  });
  it('requires authentication before reading any order', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(
      BuyerPurchaseDetailsPage({ params: Promise.resolve({ orderId }) }),
    ).rejects.toThrow('REDIRECT:');
    expect(mocks.findOrders).not.toHaveBeenCalled();
  });
  it('returns not found for any order outside the authenticated buyer list', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'buyer' } } });
    await expect(
      BuyerPurchaseDetailsPage({ params: Promise.resolve({ orderId }) }),
    ).rejects.toThrow('NOT_FOUND');
    expect(mocks.findOrders).toHaveBeenCalledWith('buyer', orderId);
  });
  it('loads tracking with the authenticated buyer identity after ownership is established', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'buyer' } } });
    mocks.findOrders.mockResolvedValue({ id: orderId });
    mocks.findTracking.mockResolvedValue(null);
    await BuyerPurchaseDetailsPage({ params: Promise.resolve({ orderId }) });
    expect(mocks.findTracking).toHaveBeenCalledWith('buyer', orderId, 'sandbox');
  });
  it('renders an owned order', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'buyer' } } });
    mocks.findOrders.mockResolvedValue({ id: orderId });
    await expect(
      BuyerPurchaseDetailsPage({ params: Promise.resolve({ orderId }) }),
    ).resolves.toBeDefined();
  });
});
