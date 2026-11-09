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

import { UpdateCustomerProfileUseCase } from '@/customers/application/use-cases/update-customer-profile.use-case';
import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';
import type { UpdateCustomerProfileDto } from '@/customers/application/dtos/update-customer-profile.dto';

function dto(overrides: Partial<UpdateCustomerProfileDto> = {}): UpdateCustomerProfileDto {
  return {
    customerId: CUSTOMER_ID,
    tenantId: TENANT,
    name: ' Maria Gomez ',
    phone: '3109876543',
    ...overrides,
  };
}

interface Harness {
  repo: InMemoryCustomerRepository;
  bus: FakeEventBus;
  useCase: UpdateCustomerProfileUseCase;
}

function setup(): Harness {
  const repo = new InMemoryCustomerRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new UpdateCustomerProfileUseCase(repo, bus) };
}

describe('UpdateCustomerProfileUseCase', (): void => {
  useFixedClock();

  it('updates name and phone, bumps the version and publishes CustomerProfileUpdatedEvent', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCustomer());

    await useCase.execute(dto());

    const customer = await stored(repo);
    expect(customer?.getName().getValue()).toBe('Maria Gomez');
    expect(customer?.getPhone().getValue()).toBe('3109876543');
    expect(customer?.getEmail().getValue()).toBe('ana@example.com');
    expect(customer?.getVersion()).toBe(1);
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toMatchObject({
      eventName: 'CustomerProfileUpdatedEvent',
      customerId: CUSTOMER_ID,
    });
  });

  it('throws CustomerNotFoundException for an unknown customer', async (): Promise<void> => {
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

    expect((await stored(repo, OTHER_TENANT))?.getName().getValue()).toBe('Ana Perez');
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it.each([
    ['name', { name: ' ' }],
    ['phone', { phone: 'abc' }],
  ])(
    'rejects an invalid %s and leaves the customer unchanged',
    async (_label, overrides): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildCustomer());

      await expect((): Promise<void> => useCase.execute(dto(overrides))).rejects.toBeInstanceOf(
        InvalidCustomerAttributeException,
      );

      expect((await stored(repo))?.getName().getValue()).toBe('Ana Perez');
      expect(repo.saveCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
    },
  );

  it('refuses a suspended customer and saves/publishes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCustomer({ status: CustomerStatus.SUSPENDED }));

    await expect((): Promise<void> => useCase.execute(dto())).rejects.toBeInstanceOf(
      InvalidCustomerStateException,
    );

    expect((await stored(repo))?.getName().getValue()).toBe('Ana Perez');
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });
});
