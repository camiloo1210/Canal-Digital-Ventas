import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryCustomerRepository } from '@/testing/in-memory/in-memory-customer.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildCustomer } from '@/testing/builders/customer.builder';
import { createCustomerId } from '@/customers/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';
import { CustomerNotFoundException } from '@/customers/application/exceptions/customer-not-found.exception';
import { InvalidCustomerStateException } from '@/customers/domain/exceptions/invalid-customer-state.exception';
import type { Customer } from '@/customers/domain/entities/customer.entity';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const CUSTOMER_ID = 'customer-1';
const NOW = new Date('2026-01-15T12:00:00.000Z');

async function stored(
  repo: InMemoryCustomerRepository,
  tenant: string = TENANT,
): Promise<Customer | null> {
  return repo.findById(createCustomerId(CUSTOMER_ID), createTenantId(tenant));
}

function useFixedClock(): void {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });
}

import { ChangeCustomerStatusUseCase } from '@/customers/application/use-cases/change-customer-status.use-case';
import { UnsupportedCustomerStatusException } from '@/customers/application/exceptions/unsupported-customer-status.exception';

interface Harness {
  repo: InMemoryCustomerRepository;
  bus: FakeEventBus;
  useCase: ChangeCustomerStatusUseCase;
}

function setup(): Harness {
  const repo = new InMemoryCustomerRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new ChangeCustomerStatusUseCase(repo, bus) };
}

describe('ChangeCustomerStatusUseCase', (): void => {
  useFixedClock();

  it.each([
    [CustomerStatus.ACTIVE, CustomerStatus.INACTIVE, 'CustomerDeactivatedEvent'],
    [CustomerStatus.ACTIVE, CustomerStatus.SUSPENDED, 'CustomerSuspendedEvent'],
    [CustomerStatus.INACTIVE, CustomerStatus.ACTIVE, 'CustomerActivatedEvent'],
    [CustomerStatus.SUSPENDED, CustomerStatus.ACTIVE, 'CustomerActivatedEvent'],
  ])(
    'moves %s to %s, bumps the version and publishes the matching event',
    async (from, to, eventName): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildCustomer({ status: from }));

      await useCase.execute({ customerId: CUSTOMER_ID, tenantId: TENANT, status: to });

      const customer = await stored(repo);
      expect(customer?.getStatus()).toBe(to);
      expect(customer?.getVersion()).toBe(1);
      expect(repo.saveCount).toBe(1);
      expect(bus.publishedLegacy).toHaveLength(1);
      expect(bus.publishedLegacy[0]).toMatchObject({ eventName, customerId: CUSTOMER_ID });
    },
  );

  it.each([CustomerStatus.ACTIVE, CustomerStatus.INACTIVE, CustomerStatus.SUSPENDED])(
    'rejects the same status %s and saves/publishes nothing',
    async (status): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildCustomer({ status }));

      await expect((): Promise<void> =>
        useCase.execute({ customerId: CUSTOMER_ID, tenantId: TENANT, status }),
      ).rejects.toBeInstanceOf(InvalidCustomerStateException);

      expect((await stored(repo))?.getStatus()).toBe(status);
      expect(repo.saveCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
    },
  );

  it('rejects an unknown status with UnsupportedCustomerStatusException', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCustomer());

    await expect((): Promise<void> =>
      useCase.execute({ customerId: CUSTOMER_ID, tenantId: TENANT, status: 'banned' }),
    ).rejects.toBeInstanceOf(UnsupportedCustomerStatusException);

    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('throws CustomerNotFoundException for an unknown customer', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    await expect((): Promise<void> =>
      useCase.execute({
        customerId: CUSTOMER_ID,
        tenantId: TENANT,
        status: CustomerStatus.INACTIVE,
      }),
    ).rejects.toBeInstanceOf(CustomerNotFoundException);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('does not touch a customer of another tenant', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCustomer({ tenantId: createTenantId(OTHER_TENANT) }));

    await expect((): Promise<void> =>
      useCase.execute({
        customerId: CUSTOMER_ID,
        tenantId: TENANT,
        status: CustomerStatus.SUSPENDED,
      }),
    ).rejects.toBeInstanceOf(CustomerNotFoundException);

    expect((await stored(repo, OTHER_TENANT))?.getStatus()).toBe(CustomerStatus.ACTIVE);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });
});
