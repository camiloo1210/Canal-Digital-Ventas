import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryCustomerRepository } from '@/testing/in-memory/in-memory-customer.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildCustomer } from '@/testing/builders/customer.builder';
import { createCustomerId } from '@/customers/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';
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

import { CreateCustomerUseCase } from '@/customers/application/use-cases/create-customer.use-case';
import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';
import { InvalidAddressException } from '@/shared/domain/exceptions/invalid-address.exception';
import type { CreateCustomerDto } from '@/customers/application/dtos/create-customer.dto';

function dto(overrides: Partial<CreateCustomerDto> = {}): CreateCustomerDto {
  return {
    id: CUSTOMER_ID,
    tenantId: TENANT,
    name: '  Ana Perez ',
    email: 'Ana@Example.com',
    phone: '+57 300 1234567',
    documentId: 'cc-100200300',
    address: {
      street: 'Calle 1',
      city: 'Bogota',
      state: 'Cundinamarca',
      zipCode: '110111',
      country: 'CO',
    },
    ...overrides,
  };
}

interface Harness {
  repo: InMemoryCustomerRepository;
  bus: FakeEventBus;
  useCase: CreateCustomerUseCase;
}

function setup(): Harness {
  const repo = new InMemoryCustomerRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new CreateCustomerUseCase(repo, bus) };
}

describe('CreateCustomerUseCase', (): void => {
  useFixedClock();

  it('creates an active customer with normalized values and publishes CustomerCreatedEvent', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();

    await useCase.execute(dto());

    const customer = await stored(repo);
    expect(customer?.getStatus()).toBe(CustomerStatus.ACTIVE);
    expect(customer?.getName().getValue()).toBe('Ana Perez');
    expect(customer?.getEmail().getValue()).toBe('ana@example.com');
    expect(customer?.getDocumentId().getValue()).toBe('CC-100200300');
    expect(customer?.getVersion()).toBe(0);
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toMatchObject({ eventName: 'CustomerCreatedEvent' });
    expect(bus.publishedLegacy[0].customerId).toBe(CUSTOMER_ID);
    expect(bus.published).toHaveLength(0);
  });

  it('stores the customer only under the tenant of the DTO', async (): Promise<void> => {
    const { repo, useCase } = setup();
    await useCase.execute(dto());
    expect(await stored(repo, OTHER_TENANT)).toBeNull();
  });

  it.each([
    ['name', { name: '   ' }],
    ['email', { email: 'not-an-email' }],
    ['phone', { phone: 'abc' }],
    ['document id', { documentId: '1234' }],
  ])(
    'rejects an invalid %s and saves/publishes nothing',
    async (_label, overrides): Promise<void> => {
      const { repo, bus, useCase } = setup();
      await expect((): Promise<void> => useCase.execute(dto(overrides))).rejects.toBeInstanceOf(
        InvalidCustomerAttributeException,
      );
      expect(repo.saveCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
    },
  );

  it('rejects an address without street and saves/publishes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    const bad = dto({
      address: { street: '', city: 'Bogota', state: 'Cundinamarca', zipCode: '1', country: 'CO' },
    });
    await expect((): Promise<void> => useCase.execute(bad)).rejects.toBeInstanceOf(
      InvalidAddressException,
    );
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  // FINDING: CreateCustomerUseCase never checks for an existing customer with the same email
  // (the port even exposes findByEmail) nor the same document, so a duplicate is saved and its
  // creation event published. Expected: the second call rejects and nothing more is saved.
  it.fails(
    'rejects a duplicate email in the same tenant and saves nothing',
    async (): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildCustomer());
      await expect((): Promise<void> =>
        useCase.execute(dto({ id: 'customer-2', documentId: 'CC-999888777' })),
      ).rejects.toBeInstanceOf(Error);
      expect(repo.saveCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
    },
  );

  // FINDING: same gap for the document id (see the duplicate email finding).
  it.fails(
    'rejects a duplicate document id in the same tenant and saves nothing',
    async (): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildCustomer());
      await expect((): Promise<void> =>
        useCase.execute(
          dto({ id: 'customer-2', email: 'other@example.com', documentId: 'CC-100200300' }),
        ),
      ).rejects.toBeInstanceOf(Error);
      expect(repo.saveCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
    },
  );

  it('allows the same email in a different tenant', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCustomer({ tenantId: createTenantId(OTHER_TENANT) }));
    await useCase.execute(dto());
    expect(repo.saveCount).toBe(1);
  });
});
