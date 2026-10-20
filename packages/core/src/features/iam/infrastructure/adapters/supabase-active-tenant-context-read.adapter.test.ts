import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseActiveTenantContextReadAdapter } from '@/iam/infrastructure/adapters/supabase-active-tenant-context-read.adapter';
import { TenantContextReadException } from '@/iam/application/exceptions/tenant-context-read.exception';

function setup(
  rows: { tenant_id: string; role: string }[],
  error: unknown = null,
): {
  adapter: SupabaseActiveTenantContextReadAdapter;
  membershipEq: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
} {
  const membership = {
    select: vi.fn(),
    eq: vi.fn(),
    returns: vi.fn().mockResolvedValue({ data: rows, error }),
  };
  membership.select.mockReturnValue(membership);
  membership.eq.mockReturnValue(membership);
  const tenant = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi
      .fn()
      .mockResolvedValue({ data: { name: 'Actual store', slug: 'actual-store' }, error: null }),
  };
  tenant.select.mockReturnValue(tenant);
  tenant.eq.mockReturnValue(tenant);
  const from = vi.fn().mockReturnValueOnce(membership).mockReturnValueOnce(tenant);
  const client = { schema: vi.fn().mockReturnValue({ from }) } as unknown as SupabaseClient;
  return {
    adapter: new SupabaseActiveTenantContextReadAdapter(client),
    membershipEq: membership.eq,
    from,
  };
}

describe('active tenant projection', (): void => {
  it('scopes to the actor and active membership, then reads the actual tenant identity', async (): Promise<void> => {
    const { adapter, membershipEq } = setup([{ tenant_id: 'tenant', role: 'OWNER' }]);
    expect(await adapter.findForUser('actor')).toEqual({
      status: 'ready',
      tenantId: 'tenant',
      tenantName: 'Actual store',
      tenantSlug: 'actual-store',
      role: 'OWNER',
    });
    expect(membershipEq).toHaveBeenCalledWith('user_id', 'actor');
    expect(membershipEq).toHaveBeenCalledWith('status', 'active');
  });
  it('returns no context when there is no active membership', async (): Promise<void> => {
    const { adapter, from } = setup([]);
    expect(await adapter.findForUser('actor')).toEqual({ status: 'none' });
    expect(from).toHaveBeenCalledTimes(1);
  });
  it('does not fetch an arbitrary store for multiple memberships', async (): Promise<void> => {
    const { adapter, from } = setup([
      { tenant_id: 'one', role: 'OWNER' },
      { tenant_id: 'two', role: 'ADMIN' },
    ]);
    expect(await adapter.findForUser('actor')).toEqual({ status: 'multiple' });
    expect(from).toHaveBeenCalledTimes(1);
  });
  it('translates a vendor failure into a typed infrastructure exception', async (): Promise<void> => {
    const { adapter } = setup([], { message: 'private vendor error' });
    await expect(adapter.findForUser('actor')).rejects.toThrow(TenantContextReadException);
  });
});
