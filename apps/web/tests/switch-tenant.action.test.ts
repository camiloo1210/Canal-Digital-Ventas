import { beforeEach, describe, expect, it, vi } from 'vitest';
import { switchTenantAction } from '@/features/iam/actions/switch-tenant.actions';

const mocks = vi.hoisted(
  (): {
    user: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  } => ({ user: vi.fn(), resolve: vi.fn(), write: vi.fn() }),
);
vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.user } }),
}));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  resolveActiveTenantQuery: mocks.resolve,
}));
vi.mock('@/features/iam/utils/active-tenant-cookie', (): object => ({
  writeActiveTenantCookie: mocks.write,
}));

const TENANT = crypto.randomUUID();

describe('switchTenantAction', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ data: { user: { id: 'actor' } } });
    mocks.resolve.mockImplementation(async (_user: string, id: string): Promise<object | null> =>
      id === TENANT
        ? { status: 'ready', tenantId: TENANT, tenantName: 'S', tenantSlug: 's', role: 'ADMIN' }
        : null,
    );
  });
  it('stores the cookie default only after verifying the active membership', async (): Promise<void> => {
    expect(await switchTenantAction(TENANT)).toEqual({ success: true, tenantId: TENANT });
    expect(mocks.resolve).toHaveBeenCalledWith('actor', TENANT);
    expect(mocks.write).toHaveBeenCalledWith(TENANT);
  });
  it('rejects a business the user does not belong to without touching the cookie', async (): Promise<void> => {
    const result = await switchTenantAction(crypto.randomUUID());
    expect(result).toMatchObject({ success: false, message: 'contextChanged' });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('rejects malformed input before any lookup', async (): Promise<void> => {
    expect(await switchTenantAction('nope')).toMatchObject({ success: false });
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('rejects anonymous callers', async (): Promise<void> => {
    mocks.user.mockResolvedValue({ data: { user: null } });
    expect(await switchTenantAction(TENANT)).toMatchObject({
      success: false,
      message: 'unauthorized',
    });
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
