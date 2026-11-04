import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  requireDashboardPermission,
  requireDashboardTenant,
} from '@/features/dashboard/queries/dashboard-context.query';

const mocks = vi.hoisted(
  (): {
    getUser: ReturnType<typeof vi.fn>;
    memberships: ReturnType<typeof vi.fn>;
    cookie: ReturnType<typeof vi.fn>;
    permissions: ReturnType<typeof vi.fn>;
  } => ({
    getUser: vi.fn(),
    memberships: vi.fn(),
    cookie: vi.fn(),
    permissions: vi.fn(),
  }),
);
vi.mock('@/features/users/queries/member-permissions.query', (): object => ({
  getMemberPermissionsQuery: mocks.permissions,
}));
vi.mock('server-only', (): object => ({}));
vi.mock('react', (): object => ({ cache: (callback: unknown): unknown => callback }));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  getActiveMembershipsQuery: mocks.memberships,
}));
vi.mock('@/features/iam/utils/active-tenant-cookie', (): object => ({
  readActiveTenantCookie: mocks.cookie,
}));
vi.mock('next/navigation', (): object => ({
  redirect: (path: string): never => {
    throw new Error('REDIRECT:' + path);
  },
}));

const ALPHA = '3f2b8c1e-9a4d-4e2b-8c7a-1d2e3f4a5b6c';
const BETA = '7a1d5e2f-0b3c-4d6e-9f81-2a3b4c5d6e7f';
const alpha = { tenantId: ALPHA, tenantName: 'Alpha', tenantSlug: 'alpha', role: 'OWNER' };
const beta = { tenantId: BETA, tenantName: 'Beta', tenantSlug: 'beta', role: 'ADMIN' };
const FOREIGN = '3b9f2a1c-0000-4000-8000-000000000000';

describe('administrative tenant context', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: 'actor', user_metadata: {}, app_metadata: { app_tenant_id: 'stale-claim' } },
      },
      error: null,
    });
    mocks.memberships.mockResolvedValue([alpha]);
    mocks.cookie.mockResolvedValue(null);
  });
  it('uses active membership rather than tenant metadata', async (): Promise<void> => {
    expect(await requireDashboardTenant()).toEqual({ userId: 'actor', tenantId: ALPHA });
    expect(mocks.memberships).toHaveBeenCalledWith('actor');
  });
  it('requires authentication before reading membership', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireDashboardTenant()).rejects.toThrow('REDIRECT:/login');
    expect(mocks.memberships).not.toHaveBeenCalled();
  });
  it('sends a user without an active membership to onboarding', async (): Promise<void> => {
    mocks.memberships.mockResolvedValue([]);
    await expect(requireDashboardTenant()).rejects.toThrow('REDIRECT:/onboarding');
  });
  describe('user managing several businesses', (): void => {
    beforeEach((): void => {
      mocks.memberships.mockResolvedValue([alpha, beta]);
    });
    it('uses the explicit tenant when the user is an active member of it', async (): Promise<void> => {
      mocks.cookie.mockResolvedValue(ALPHA);
      expect(await requireDashboardTenant(BETA)).toEqual({ userId: 'actor', tenantId: BETA });
    });
    it('prefers the explicit tenant over the cookie default', async (): Promise<void> => {
      mocks.cookie.mockResolvedValue(BETA);
      expect(await requireDashboardTenant(ALPHA)).toEqual({ userId: 'actor', tenantId: ALPHA });
    });
    it('falls back to the cookie when no tenant is requested', async (): Promise<void> => {
      mocks.cookie.mockResolvedValue(BETA);
      expect(await requireDashboardTenant()).toEqual({ userId: 'actor', tenantId: BETA });
    });
    it('sends the user to the selector when neither tenant nor cookie is usable', async (): Promise<void> => {
      await expect(requireDashboardTenant()).rejects.toThrow('REDIRECT:/dashboard/select-business');
      mocks.cookie.mockResolvedValue(FOREIGN);
      await expect(requireDashboardTenant()).rejects.toThrow('REDIRECT:/dashboard/select-business');
    });
    it('never honours a tenant the user is not an active member of, even with a valid cookie', async (): Promise<void> => {
      mocks.cookie.mockResolvedValue(ALPHA);
      await expect(requireDashboardTenant(FOREIGN)).rejects.toThrow(
        'REDIRECT:/dashboard/select-business',
      );
      await expect(requireDashboardTenant('not-a-uuid')).rejects.toThrow(
        'REDIRECT:/dashboard/select-business',
      );
    });
    it('checks permissions against the explicit tenant, not the cookie', async (): Promise<void> => {
      mocks.cookie.mockResolvedValue(ALPHA);
      mocks.permissions.mockResolvedValue({ baseRole: 'OWNER', roleName: null, permissions: [] });
      await requireDashboardPermission('VIEW_REPORTS' as never, BETA);
      expect(mocks.permissions).toHaveBeenCalledWith('actor', BETA);
    });
  });
  it('rejects an explicit tenant that a single-business user does not belong to', async (): Promise<void> => {
    await expect(requireDashboardTenant(BETA)).rejects.toThrow(
      'REDIRECT:/dashboard/select-business',
    );
  });
  it('keeps URLs without a tenant working for a single-business user', async (): Promise<void> => {
    mocks.permissions.mockResolvedValue({ baseRole: 'OWNER', roleName: null, permissions: [] });
    await expect(requireDashboardPermission('VIEW_REPORTS' as never)).resolves.toMatchObject({
      tenantId: ALPHA,
    });
  });
  describe('suspended or unlinked member (existing session)', (): void => {
    it('loses dashboard access on the next request because membership is read from the database', async (): Promise<void> => {
      mocks.memberships.mockResolvedValue([]);
      await expect(requireDashboardTenant()).rejects.toThrow('REDIRECT:/onboarding');
      mocks.memberships.mockResolvedValue([alpha]);
      mocks.permissions.mockResolvedValue(null);
      await expect(requireDashboardPermission('VIEW_ORDERS' as never)).rejects.toThrow(
        'REDIRECT:/dashboard',
      );
    });
  });
  describe('permission guard', (): void => {
    it('lets the owner through whatever the required permission', async (): Promise<void> => {
      mocks.permissions.mockResolvedValue({ baseRole: 'OWNER', roleName: null, permissions: [] });
      const result = await requireDashboardPermission('VIEW_REPORTS' as never);
      expect(result.userId).toBe('actor');
      expect(mocks.permissions).toHaveBeenCalledWith('actor', ALPHA);
    });
    it('lets a member with any one of the permissions through', async (): Promise<void> => {
      mocks.permissions.mockResolvedValue({
        baseRole: 'MEMBER',
        roleName: 'Seller',
        permissions: ['VIEW_ORDERS'],
      });
      await expect(
        requireDashboardPermission(['VIEW_ORDERS', 'MANAGE_ORDERS'] as never),
      ).resolves.toMatchObject({ userId: 'actor' });
    });
    it('redirects a member without the permission to the overview notice', async (): Promise<void> => {
      mocks.permissions.mockResolvedValue({
        baseRole: 'MEMBER',
        roleName: 'Seller',
        permissions: ['VIEW_ORDERS'],
      });
      await expect(requireDashboardPermission('MANAGE_STORE' as never)).rejects.toThrow(
        'REDIRECT:/dashboard?denied=1',
      );
    });
    it('keeps the explicit tenant on the denied redirect', async (): Promise<void> => {
      mocks.memberships.mockResolvedValue([alpha, beta]);
      mocks.permissions.mockResolvedValue({ baseRole: 'MEMBER', roleName: null, permissions: [] });
      await expect(requireDashboardPermission('MANAGE_STORE' as never, BETA)).rejects.toThrow(
        'REDIRECT:/dashboard?denied=1&tenant=' + BETA,
      );
    });
    it('redirects a user whose membership is not active', async (): Promise<void> => {
      mocks.permissions.mockResolvedValue(null);
      await expect(requireDashboardPermission('VIEW_ORDERS' as never)).rejects.toThrow(
        'REDIRECT:/dashboard',
      );
    });
  });
});
