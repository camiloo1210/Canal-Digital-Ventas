import { describe, expect, it } from 'vitest';
import { InMemoryCustomerRepository } from '@/testing/in-memory/in-memory-customer.repository';
import { buildCustomer } from '@/testing/builders/customer.builder';
import { createCustomerId } from '@/customers/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';
import { CustomerName } from '@/customers/domain/value-objects/customer-name.vo';
import { Email } from '@/customers/domain/value-objects/email.vo';
import { SearchCustomersUseCase } from '@/customers/application/use-cases/search-customers.use-case';
import type { Customer } from '@/customers/domain/entities/customer.entity';

const TENANT = 'tenant-1';

function seeded(): { useCase: SearchCustomersUseCase; repo: InMemoryCustomerRepository } {
  const repo = new InMemoryCustomerRepository();
  repo.seed(
    buildCustomer(),
    buildCustomer({
      id: createCustomerId('customer-2'),
      name: CustomerName.from('Carlos Ruiz'),
      email: Email.from('carlos@shop.com'),
      status: CustomerStatus.INACTIVE,
    }),
    buildCustomer({
      id: createCustomerId('customer-3'),
      name: CustomerName.from('Ana Maria Lopez'),
      email: Email.from('lopez@shop.com'),
      status: CustomerStatus.SUSPENDED,
    }),
    buildCustomer({
      id: createCustomerId('customer-9'),
      tenantId: createTenantId('tenant-2'),
      name: CustomerName.from('Ana Other Tenant'),
    }),
  );
  return { repo, useCase: new SearchCustomersUseCase(repo) };
}

function ids(items: Customer[]): string[] {
  return items.map((customer): string => customer.getId());
}

describe('SearchCustomersUseCase', (): void => {
  it('returns only the customers of the requested tenant', async (): Promise<void> => {
    const { useCase } = seeded();
    const result = await useCase.execute({ tenantId: TENANT });
    expect(ids(result.items)).toEqual(['customer-1', 'customer-2', 'customer-3']);
    expect(result.totalItems).toBe(3);
  });

  it('returns nothing for a tenant without customers', async (): Promise<void> => {
    const { useCase } = seeded();
    const result = await useCase.execute({ tenantId: 'tenant-empty' });
    expect(result.items).toEqual([]);
    expect(result.totalItems).toBe(0);
  });

  it('matches the search term against name or email, case-insensitively', async (): Promise<void> => {
    const { useCase } = seeded();
    expect(ids((await useCase.execute({ tenantId: TENANT, searchTerm: 'ANA' })).items)).toEqual([
      'customer-1',
      'customer-3',
    ]);
    expect(
      ids((await useCase.execute({ tenantId: TENANT, searchTerm: 'shop.com' })).items),
    ).toEqual(['customer-2', 'customer-3']);
  });

  it('filters by one or several statuses', async (): Promise<void> => {
    const { useCase } = seeded();
    const inactive = await useCase.execute({ tenantId: TENANT, status: [CustomerStatus.INACTIVE] });
    expect(ids(inactive.items)).toEqual(['customer-2']);
    const two = await useCase.execute({
      tenantId: TENANT,
      status: [CustomerStatus.ACTIVE, CustomerStatus.SUSPENDED],
    });
    expect(ids(two.items)).toEqual(['customer-1', 'customer-3']);
  });

  it('paginates and reports totals', async (): Promise<void> => {
    const { useCase } = seeded();
    const page2 = await useCase.execute({ tenantId: TENANT, pagination: { page: 2, limit: 2 } });
    expect(ids(page2.items)).toEqual(['customer-3']);
    expect(page2.totalItems).toBe(3);
    expect(page2.totalPages).toBe(2);
    expect(page2.currentPage).toBe(2);
  });

  it('does not write anything', async (): Promise<void> => {
    const { repo, useCase } = seeded();
    await useCase.execute({ tenantId: TENANT, searchTerm: 'ana' });
    expect(repo.saveCount).toBe(0);
  });

  // OBSERVATION encoded as behavior: status strings are cast, not validated, so an unknown
  // status silently yields an empty page instead of an error.
  it('returns an empty page for an unknown status string', async (): Promise<void> => {
    const { useCase } = seeded();
    const result = await useCase.execute({ tenantId: TENANT, status: ['banned'] });
    expect(result.items).toEqual([]);
  });
});
