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

import { ChangeCustomerAddressUseCase } from '@/customers/application/use-cases/change-customer-address.use-case';
import { InvalidAddressException } from '@/shared/domain/exceptions/invalid-address.exception';
import type { ChangeCustomerAddressDto } from '@/customers/application/dtos/change-customer-address.dto';

function dto(overrides: Partial<ChangeCustomerAddressDto> = {}): ChangeCustomerAddressDto {
  return {
    customerId: CUSTOMER_ID,
    tenantId: TENANT,
    address: {
      street: ' Carrera 7 ',
      city: 'Medellin',
      state: 'Antioquia',
      zipCode: '050001',
      country: 'CO',
    },
    ...overrides,
  };
}

interface Harness {
  repo: InMemoryCustomerRepository;
  bus: FakeEventBus;
  useCase: ChangeCustomerAddressUseCase;
}

function setup(): Harness {
  const repo = new InMemoryCustomerRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new ChangeCustomerAddressUseCase(repo, bus) };
}

describe('ChangeCustomerAddressUseCase', (): void => {
  useFixedClock();

  it('changes the address, bumps the version and publishes CustomerAddressChangedEvent', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCustomer());

    await useCase.execute(dto());

    const customer = await stored(repo);
    expect(customer?.getAddress().getStreet()).toBe('Carrera 7');
    expect(customer?.getAddress().getCity()).toBe('Medellin');
    expect(customer?.getVersion()).toBe(1);
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toMatchObject({
      eventName: 'CustomerAddressChangedEvent',
      customerId: CUSTOMER_ID,
    });
  });

  it('throws CustomerNotFoundException for an unknown customer and publishes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    await expect((): Promise<void> => useCase.execute(dto())).rejects.toBeInstanceOf(
      CustomerNotFoundException,
    );
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('does not touch a customer of another tenant', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCustomer({ tenantId: createTenantId(OTHER_TENANT) }));

    await expect((): Promise<void> => useCase.execute(dto())).rejects.toBeInstanceOf(
      CustomerNotFoundException,
    );

    const untouched = await stored(repo, OTHER_TENANT);
    expect(untouched?.getAddress().getCity()).toBe('Bogota');
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('rejects an invalid address and leaves the stored customer unchanged', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCustomer());
    const bad = dto({
      address: { street: '', city: 'x', state: 'y', zipCode: '1', country: 'CO' },
    });

    await expect((): Promise<void> => useCase.execute(bad)).rejects.toBeInstanceOf(
      InvalidAddressException,
    );

    expect((await stored(repo))?.getAddress().getCity()).toBe('Bogota');
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('refuses a suspended customer and saves/publishes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCustomer({ status: CustomerStatus.SUSPENDED }));

    await expect((): Promise<void> => useCase.execute(dto())).rejects.toBeInstanceOf(
      InvalidCustomerStateException,
    );

    expect((await stored(repo))?.getAddress().getCity()).toBe('Bogota');
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });
});
