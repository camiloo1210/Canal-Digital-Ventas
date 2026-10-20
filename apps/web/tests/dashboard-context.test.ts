import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDashboardTenant } from '@/features/dashboard/queries/dashboard-context.query';

const mocks = vi.hoisted(
  (): { getUser: ReturnType<typeof vi.fn>; context: ReturnType<typeof vi.fn> } => ({
    getUser: vi.fn(),
    context: vi.fn(),
  }),
);
vi.mock('server-only', (): object => ({}));
vi.mock('react', (): object => ({ cache: (callback: unknown): unknown => callback }));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  getActiveTenantContextQuery: mocks.context,
}));
vi.mock('next/navigation', (): object => ({
  redirect: (path: string): never => {
    throw new Error('REDIRECT:' + path);
  },
}));

describe('administrative tenant context', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: 'actor', user_metadata: {}, app_metadata: { app_tenant_id: 'stale-claim' } },
      },
      error: null,
    });
    mocks.context.mockResolvedValue({
      status: 'ready',
      tenantId: 'active-membership',
      tenantName: 'Store',
      tenantSlug: 'store',
      role: 'OWNER',
    });
  });
  it('uses active membership rather than tenant metadata', async (): Promise<void> => {
    expect(await requireDashboardTenant()).toEqual({
      userId: 'actor',
      tenantId: 'active-membership',
    });
    expect(mocks.context).toHaveBeenCalledWith('actor');
  });
  it('requires authentication before reading membership', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireDashboardTenant()).rejects.toThrow('REDIRECT:/login');
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it('sends a user without an active membership to onboarding', async (): Promise<void> => {
    mocks.context.mockResolvedValue({ status: 'none' });
    await expect(requireDashboardTenant()).rejects.toThrow('REDIRECT:/onboarding');
  });
  it('returns to the dashboard context state without picking a random tenant', async (): Promise<void> => {
    mocks.context.mockResolvedValue({ status: 'multiple' });
    await expect(requireDashboardTenant()).rejects.toThrow('REDIRECT:/dashboard');
  });
});
