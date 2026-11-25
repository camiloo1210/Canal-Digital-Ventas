import { describe, expect, it } from 'vitest';
import { SupabaseCustomerRepository } from '@/customers/infrastructure/repositories/supabase-customer.repository';
import { SupabaseCustomerMapper } from '@/customers/infrastructure/mappers/supabase-customer.mapper';
import { CustomerRepositoryException } from '@/customers/application/exceptions/customer-repository.exception';
import type { Customer } from '@/customers/domain/entities/customer.entity';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';
import { createCustomerId } from '@/customers/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { buildCustomer } from '@/testing/builders/customer.builder';
import { FakeSupabase } from '@/testing/fakes/fake-supabase-client';

const tenantId = createTenantId('tenant-1');
const customerId = createCustomerId('customer-1');
const row = SupabaseCustomerMapper.toPersistence(buildCustomer());

function setup(): { fake: FakeSupabase; repo: SupabaseCustomerRepository } {
  const fake = new FakeSupabase();
  return { fake, repo: new SupabaseCustomerRepository(fake.asClient()) };
}

describe('SupabaseCustomerRepository', (): void => {
  describe('save', (): void => {
    it('upserts the persisted row through the transactional rpc', async (): Promise<void> => {
      const { fake, repo } = setup();
      await repo.save(buildCustomer());
      expect(fake.callsFor('rpc:upsert_customer_transactional')[0].args).toEqual([
        { customer_data: row },
      ]);
    });

    it('maps P0001 to an optimistic locking failure', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('rpc:upsert_customer_transactional', { error: { code: 'P0001', message: 'x' } });
      await expect(repo.save(buildCustomer())).rejects.toThrow(/Optimistic locking failure/);
    });

    it('wraps other errors', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('rpc:upsert_customer_transactional', { error: { code: '500', message: 'boom' } });
      await expect(repo.save(buildCustomer())).rejects.toMatchObject({
        name: 'CustomerRepositoryException',
        message: 'Failed to save customer: boom',
      });
    });
  });

  describe.each([
    [
      'findById',
      (r: SupabaseCustomerRepository): Promise<Customer | null> => r.findById(customerId, tenantId),
    ],
    [
      'findByEmail',
      (r: SupabaseCustomerRepository): Promise<Customer | null> =>
        r.findByEmail('ana@example.com', tenantId),
    ],
  ])('%s', (_name, call): void => {
    it('returns the tenant-scoped customer', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.customers', { data: row });
      const found = await call(repo);
      expect(found?.getId()).toBe('customer-1');
      expect(fake.callsFor('public.customers').map((c): string => c.method)).toContain('single');
      expect(fake.callsFor('public.customers')).toContainEqual({
        target: 'public.customers',
        method: 'eq',
        args: ['tenant_id', tenantId],
      });
    });

    it('returns null when not found (PGRST116) or no data', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.customers', { error: { code: 'PGRST116', message: 'none' } });
      expect(await call(repo)).toBeNull();
      fake.on('public.customers', { data: null });
      expect(await call(repo)).toBeNull();
    });

    it('throws on any other database error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.customers', { error: { code: '500', message: 'down' } });
      await expect(call(repo)).rejects.toBeInstanceOf(CustomerRepositoryException);
    });
  });

  describe('findAll', (): void => {
    it('paginates with defaults', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.customers', { data: [row], count: 41 });
      const page = await repo.findAll(tenantId);
      expect(page).toMatchObject({ totalItems: 41, totalPages: 3, currentPage: 1 });
      expect(page.items).toHaveLength(1);
      expect(fake.callsFor('public.customers')).toContainEqual({
        target: 'public.customers',
        method: 'range',
        args: [0, 19],
      });
    });

    it('honours explicit pagination and null data/count', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.customers', { data: null, count: null });
      const page = await repo.findAll(tenantId, { page: 3, limit: 5 });
      expect(page).toEqual({ items: [], totalItems: 0, totalPages: 0, currentPage: 3 });
      expect(fake.callsFor('public.customers')).toContainEqual({
        target: 'public.customers',
        method: 'range',
        args: [10, 14],
      });
    });

    it('throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.customers', { error: { message: 'bad' } });
      await expect(repo.findAll(tenantId)).rejects.toThrow('Failed to get customers: bad');
    });
  });

  describe('searchByFilters', (): void => {
    it('applies every filter', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.customers', { data: [row], count: 1 });
      const page = await repo.searchByFilters(
        {
          tenantId,
          id: customerId,
          status: [CustomerStatus.ACTIVE],
          searchTerm: 'ana',
        },
        { page: 2, limit: 10 },
      );
      expect(page.items).toHaveLength(1);
      const methods = fake.callsFor('public.customers').map((c): string => c.method);
      expect(methods).toEqual(expect.arrayContaining(['eq', 'in', 'or', 'range', 'order']));
      expect(fake.callsFor('public.customers')).toContainEqual({
        target: 'public.customers',
        method: 'or',
        args: ['full_name.ilike.%ana%,email.ilike.%ana%'],
      });
    });

    it('applies no optional filter when absent', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.customers', { data: null, count: null });
      const page = await repo.searchByFilters({ tenantId, status: [] });
      expect(page.items).toEqual([]);
      const methods = fake.callsFor('public.customers').map((c): string => c.method);
      expect(methods).not.toContain('in');
      expect(methods).not.toContain('or');
    });

    it('throws on error', async (): Promise<void> => {
      const { fake, repo } = setup();
      fake.on('public.customers', { error: { message: 'bad' } });
      await expect(repo.searchByFilters({ tenantId })).rejects.toThrow(
        'Failed to search customers: bad',
      );
    });
  });
});
