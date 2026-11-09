import { describe, expect, it, vi } from 'vitest';
import {
  enableTrackingAction,
  disableTrackingAction,
} from '@/features/orders/actions/enable-tracking.actions';
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  tenant: vi.fn(),
  permitted: vi.fn(),
  resolve: vi.fn(),
  resolveDisable: vi.fn(),
  execute: vi.fn(),
}));
vi.mock('next-intl/server', () => ({
  getTranslations:
    async () =>
    (key: string): string =>
      key,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/features/dashboard/server/resolve-action-tenant', () => ({
  resolveActionTenant: mocks.tenant,
}));
vi.mock('@/features/users/queries/member-permissions.query', () => ({
  userHasAnyPermission: mocks.permitted,
}));
vi.mock('@/features/orders/di/orders.di', () => ({
  ordersDi: {
    resolveEnableTrackingUseCase: mocks.resolve,
    resolveDisableTrackingUseCase: mocks.resolveDisable,
  },
}));
describe('enable tracking action', (): void => {
  it('rejects a read-only seller before invoking the use case', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: crypto.randomUUID() } } });
    mocks.tenant.mockResolvedValue({ tenantId: crypto.randomUUID() });
    mocks.permitted.mockResolvedValue(false);
    mocks.execute.mockClear();
    const form = new FormData();
    form.set('orderId', crypto.randomUUID());
    form.set('version', '2');
    expect((await enableTrackingAction({ success: false, message: '' }, form)).success).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('disables tracking using the authenticated actor and verified tenant', async (): Promise<void> => {
    const actor = crypto.randomUUID(),
      tenant = crypto.randomUUID(),
      order = crypto.randomUUID();
    mocks.getUser.mockResolvedValue({ data: { user: { id: actor } } });
    mocks.tenant.mockResolvedValue({ tenantId: tenant });
    mocks.permitted.mockResolvedValue(true);
    mocks.execute.mockResolvedValue(undefined);
    mocks.resolveDisable.mockReturnValue({ execute: mocks.execute });
    const form = new FormData();
    form.set('orderId', order);
    form.set('version', '2');
    expect((await disableTrackingAction({ success: false, message: '' }, form)).success).toBe(true);
    expect(mocks.execute).toHaveBeenCalledWith({
      tenantId: tenant,
      orderId: order,
      authenticatedSellerId: actor,
      expectedShipmentVersion: 2,
    });
  });
  it('injects authenticated actor and resolved tenant', async (): Promise<void> => {
    const actor = crypto.randomUUID(),
      tenant = crypto.randomUUID(),
      order = crypto.randomUUID();
    mocks.getUser.mockResolvedValue({ data: { user: { id: actor } } });
    mocks.tenant.mockResolvedValue({ tenantId: tenant });
    mocks.permitted.mockResolvedValue(true);
    mocks.execute.mockResolvedValue(undefined);
    mocks.resolve.mockReturnValue({ execute: mocks.execute });
    const form = new FormData();
    form.set('orderId', order);
    form.set('version', '2');
    expect((await enableTrackingAction({ success: false, message: '' }, form)).success).toBe(true);
    expect(mocks.execute).toHaveBeenCalledWith({
      tenantId: tenant,
      orderId: order,
      authenticatedSellerId: actor,
      expectedShipmentVersion: 2,
      provider: 'fedex',
    });
  });
});
