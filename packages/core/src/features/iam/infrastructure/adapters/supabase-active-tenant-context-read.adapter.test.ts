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

interface Chain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  returns: ReturnType<typeof vi.fn>;
}

function chain(result: { data: unknown; error: unknown }): Chain {
  const c: Chain = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    returns: vi.fn().mockResolvedValue(result),
  };
  c.select.mockReturnValue(c);
  c.eq.mockReturnValue(c);
  c.in.mockReturnValue(c);
  return c;
}

function multiSetup(
  memberships: { tenant_id: string; role: string }[],
  tenants: { id: string; name: string; slug: string }[],
  error: unknown = null,
): {
  adapter: SupabaseActiveTenantContextReadAdapter;
  membership: Chain;
  tenant: Chain;
} {
  const membership = chain({ data: memberships, error });
  const tenant = chain({ data: tenants, error: null });
  const from = vi.fn().mockReturnValueOnce(membership).mockReturnValueOnce(tenant);
  const client = { schema: vi.fn().mockReturnValue({ from }) } as unknown as SupabaseClient;
  return { adapter: new SupabaseActiveTenantContextReadAdapter(client), membership, tenant };
}

describe('all active memberships of a user', (): void => {
  it('lists every active membership with business identity and role, scoped to the actor', async (): Promise<void> => {
    const { adapter, membership, tenant } = multiSetup(
      [
        { tenant_id: 'one', role: 'OWNER' },
        { tenant_id: 'two', role: 'ADMIN' },
      ],
      [
        { id: 'two', name: 'Beta', slug: 'beta' },
        { id: 'one', name: 'Alpha', slug: 'alpha' },
      ],
    );
    expect(await adapter.findAllActiveForUser('actor')).toEqual([
      { tenantId: 'one', tenantName: 'Alpha', tenantSlug: 'alpha', role: 'OWNER' },
      { tenantId: 'two', tenantName: 'Beta', tenantSlug: 'beta', role: 'ADMIN' },
    ]);
    expect(membership.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(membership.eq).toHaveBeenCalledWith('status', 'active');
    expect(tenant.in).toHaveBeenCalledWith('id', ['one', 'two']);
  });
  it('returns an empty list without reading tenants when there is no active membership', async (): Promise<void> => {
    const { adapter, tenant } = multiSetup([], []);
    expect(await adapter.findAllActiveForUser('actor')).toEqual([]);
    expect(tenant.select).not.toHaveBeenCalled();
  });
  it('translates vendor failures', async (): Promise<void> => {
    const { adapter } = multiSetup([], [], { message: 'private' });
    await expect(adapter.findAllActiveForUser('actor')).rejects.toThrow(TenantContextReadException);
  });
});

describe('resolving a requested tenant for a user', (): void => {
  it('returns a ready context only for an active membership of that exact tenant', async (): Promise<void> => {
    const { adapter, membership } = multiSetup(
      [{ tenant_id: 'two', role: 'ADMIN' }],
      [{ id: 'two', name: 'Beta', slug: 'beta' }],
    );
    expect(await adapter.resolveForUser('actor', 'two')).toEqual({
      status: 'ready',
      tenantId: 'two',
      tenantName: 'Beta',
      tenantSlug: 'beta',
      role: 'ADMIN',
    });
    expect(membership.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(membership.eq).toHaveBeenCalledWith('status', 'active');
    expect(membership.eq).toHaveBeenCalledWith('tenant_id', 'two');
  });
  it('returns null for a tenant the user does not actively belong to', async (): Promise<void> => {
    const { adapter, tenant } = multiSetup([], []);
    expect(await adapter.resolveForUser('actor', 'foreign')).toBeNull();
    expect(tenant.select).not.toHaveBeenCalled();
  });
  it('translates vendor failures', async (): Promise<void> => {
    const { adapter } = multiSetup([], [], { message: 'private' });
    await expect(adapter.resolveForUser('actor', 'x')).rejects.toThrow(TenantContextReadException);
  });
});
