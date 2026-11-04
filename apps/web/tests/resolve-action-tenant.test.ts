import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';

const mocks = vi.hoisted((): { resolve: ReturnType<typeof vi.fn> } => ({ resolve: vi.fn() }));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  resolveActiveTenantQuery: mocks.resolve,
}));

const tenantId = crypto.randomUUID();
const ready = {
  status: 'ready',
  tenantId,
  tenantName: 'Alpha',
  tenantSlug: 'alpha',
  role: 'OWNER',
};

function form(value?: string): FormData {
  const data = new FormData();
  if (value !== undefined) data.set('tenantId', value);
  return data;
}

describe('resolveActionTenant', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue(ready);
  });
  it('returns the tenant of the submitted id when the user is an active member', async (): Promise<void> => {
    expect(await resolveActionTenant(form(tenantId), 'actor')).toEqual({
      tenantId,
      tenantSlug: 'alpha',
      role: 'OWNER',
    });
    expect(mocks.resolve).toHaveBeenCalledWith('actor', tenantId);
  });
  it('accepts an explicit id argument for programmatic calls and validates it the same way', async (): Promise<void> => {
    expect(await resolveActionTenant(tenantId, 'actor')).toMatchObject({ tenantId });
    expect(await resolveActionTenant('nope', 'actor')).toBeNull();
    expect(await resolveActionTenant(null, 'actor')).toBeNull();
  });
  it('rejects an absent field without any lookup', async (): Promise<void> => {
    expect(await resolveActionTenant(form(), 'actor')).toBeNull();
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it('rejects a malformed id without any lookup', async (): Promise<void> => {
    expect(await resolveActionTenant(form('not-a-uuid'), 'actor')).toBeNull();
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it('rejects a tenant where the user has no active membership', async (): Promise<void> => {
    mocks.resolve.mockResolvedValue(null);
    expect(await resolveActionTenant(form(crypto.randomUUID()), 'actor')).toBeNull();
  });
});
