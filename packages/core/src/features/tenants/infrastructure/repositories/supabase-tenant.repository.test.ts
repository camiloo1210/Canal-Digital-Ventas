import { describe, expect, it } from 'vitest';
import { SupabaseTenantRepository } from '@/tenants/infrastructure/repositories/supabase-tenant.repository';
import { SupabaseTenantMapper } from '@/tenants/infrastructure/mappers/supabase-tenant.mapper';
import { TenantRepositoryException } from '@/tenants/application/exceptions/tenant-repository.exception';
import { SlugAlreadyTakenException } from '@/tenants/application/exceptions/slug-already-taken.exception';
import { BusinessAccountBoundException } from '@/iam/application/exceptions/business-account-bound.exception';
import { TenantStatus } from '@/tenants/domain/enums/tenant-status.enum';
import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { buildTenant } from '@/testing/builders/tenant.builder';
import { FakeSupabase } from '@/testing/fakes/fake-supabase-client';

const tenant = buildTenant();
const row = SupabaseTenantMapper.toPersistence(tenant);
const RPC = 'rpc:upsert_tenant_transactional';

function setup(): { fake: FakeSupabase; repo: SupabaseTenantRepository } {
  const fake = new FakeSupabase();
  return { fake, repo: new SupabaseTenantRepository(fake.asClient()) };
}

describe('SupabaseTenantRepository', (): void => {
  describe('save', (): void => {
    it('upserts the persisted row', async (): Promise<void> => {
      const { fake, repo } = setup();
      await repo.save(tenant);
      expect(fake.callsFor(RPC)[0].args).toEqual([{ tenant_data: row }]);
    });

    it('maps 23505 to SlugAlreadyTakenException', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(RPC, { error: { code: '23505', message: 'dup' } });
      await expect(repo.save(tenant)).rejects.toBeInstanceOf(SlugAlreadyTakenException);
    });

    it('maps P0001 to optimistic locking and wraps other errors', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(RPC, { error: { code: 'P0001', message: 'x' } });
      await expect(repo.save(tenant)).rejects.toThrow(/Optimistic locking failed/);
      fake.on(RPC, { error: { code: '500', message: 'boom' } });
      await expect(repo.save(tenant)).rejects.toThrow('Failed to save tenant: boom');
    });
  });

  describe('onboard', (): void => {
    it('calls the core rpc with the idempotency key, owner and tenant data', async (): Promise<void> => {
      const { fake, repo } = setup();
      await repo.onboard(tenant, 'user-1', { name: 'Ana' }, 'key-1');
      expect(fake.callsFor('rpc:onboard_tenant_transactional')[0].args).toEqual([
        {
          p_idempotency_key: 'key-1',
          p_user_id: 'user-1',
          p_tenant_data: row,
          p_user_data: { name: 'Ana' },
        },
      ]);
    });

    it('maps 23505 to SlugAlreadyTakenException', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('rpc:onboard_tenant_transactional', { error: { code: '23505', message: 'dup' } });
      await expect(repo.onboard(tenant, 'u', {}, 'k')).rejects.toBeInstanceOf(
        SlugAlreadyTakenException,
      );
    });

    it('maps P0004 and wraps other errors', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('rpc:onboard_tenant_transactional', { error: { code: 'P0004', message: 'x' } });
      await expect(repo.onboard(tenant, 'u', {}, 'k')).rejects.toBeInstanceOf(
        BusinessAccountBoundException,
      );
      fake.on('rpc:onboard_tenant_transactional', { error: { code: '500', message: 'boom' } });
      await expect(repo.onboard(tenant, 'u', {}, 'k')).rejects.toThrow(
        'Failed to onboard tenant: boom',
      );
    });
  });

  describe('update', (): void => {
    it('upserts the row', async (): Promise<void> => {
      const { fake, repo } = setup();
      await repo.update(tenant);
      expect(fake.callsFor(RPC)).toHaveLength(1);
    });

    it('maps P0001 and wraps other errors', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on(RPC, { error: { code: 'P0001', message: 'x' } });
      await expect(repo.update(tenant)).rejects.toThrow(/Optimistic locking failed/);
      fake.on(RPC, { error: { code: '500', message: 'boom' } });
      await expect(repo.update(tenant)).rejects.toThrow('Failed to update tenant: boom');
    });
  });

  describe('delete', (): void => {
    it('deletes by id', async (): Promise<void> => {
      const { fake, repo } = setup();
      await repo.delete(tenant.getId());
      expect(fake.callsFor('public.tenants')).toContainEqual({
        target: 'public.tenants',
        method: 'eq',
        args: ['id', 'tenant-1'],
      });
    });

    it('throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.tenants', { error: { message: 'bad' } });
      await expect(repo.delete(tenant.getId())).rejects.toBeInstanceOf(TenantRepositoryException);
    });
  });

  describe('findById and findBySlug', (): void => {
    it('return the tenant', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.tenants', { data: row });
      expect((await repo.findById(createTenantId('tenant-1')))?.getId()).toBe('tenant-1');
      expect((await repo.findBySlug(TenantSlug.create('test-store')))?.getId()).toBe('tenant-1');
    });

    it('return null for PGRST116 or no data', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.tenants', { error: { code: 'PGRST116', message: 'none' } });
      expect(await repo.findById(createTenantId('t'))).toBeNull();
      expect(await repo.findBySlug(TenantSlug.create('test-store'))).toBeNull();
      fake.on('public.tenants', { data: null });
      expect(await repo.findById(createTenantId('t'))).toBeNull();
      expect(await repo.findBySlug(TenantSlug.create('test-store'))).toBeNull();
    });

    it('throw on other errors', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.tenants', { error: { code: '500', message: 'down' } });
      await expect(repo.findById(createTenantId('t'))).rejects.toThrow(
        'Database error searching tenant: down',
      );
      await expect(repo.findBySlug(TenantSlug.create('test-store'))).rejects.toThrow(
        'Database error searching tenant by slug: down',
      );
    });
  });

  describe('searchByFilters and findAll', (): void => {
    it('applies every filter and paginates', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.tenants', { data: [row], count: 1 });
      const page = await repo.searchByFilters(
        {
          id: createTenantId('tenant-1'),
          slug: TenantSlug.create('test-store'),
          name: TenantName.create('Test store'),
          status: [TenantStatus.ACTIVE],
        },
        { page: 2, limit: 5 },
      );
      expect(page).toMatchObject({ totalItems: 1, totalPages: 1, currentPage: 2 });
      const calls = fake.callsFor('public.tenants');
      expect(calls).toContainEqual({
        target: 'public.tenants',
        method: 'ilike',
        args: ['name', '%Test store%'],
      });
      expect(calls).toContainEqual({
        target: 'public.tenants',
        method: 'in',
        args: ['status', ['active']],
      });
      expect(calls).toContainEqual({ target: 'public.tenants', method: 'range', args: [5, 9] });
    });

    it('applies no optional filter by default and tolerates null data', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.tenants', { data: null, count: null });
      expect(await repo.findAll({ status: [] })).toEqual({
        items: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
      });
      expect(fake.callsFor('public.tenants').map((c): string => c.method)).not.toContain('in');
    });

    it('throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.tenants', { error: { message: 'bad' } });
      await expect(repo.searchByFilters({})).rejects.toThrow('Failed to search tenants: bad');
    });
  });
});
