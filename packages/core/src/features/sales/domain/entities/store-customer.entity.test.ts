import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreCustomer } from '@/sales/domain/entities/store-customer.entity';
import { StoreCustomerStatus } from '@/sales/domain/enums/store-customer-status.enum';
import { InvalidStoreCustomerAttributeException } from '@/sales/domain/exceptions/invalid-store-customer-attribute.exception';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { createStoreCustomerId } from '@/sales/domain/types/customer-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Address } from '@/shared/domain/value-objects/adress.vo';

const ID = createStoreCustomerId('cust-1');
const TENANT_ID = createTenantId('tenant-1');
const AUTH_ID = createGlobalAuthId('auth-1');
const T0 = new Date('2026-01-01T00:00:00.000Z');
const T1 = new Date('2026-01-02T00:00:00.000Z');

function makeAddress(): Address {
  return Address.create('Calle 1', 'Bogota', 'Cundinamarca', '110111', 'CO');
}

function makeCustomer(): StoreCustomer {
  return StoreCustomer.create(
    ID,
    TENANT_ID,
    AUTH_ID,
    'Ana Gomez',
    'ana@example.com',
    '3001234567',
    '123456',
    makeAddress(),
  );
}

function makeWithStatus(status: StoreCustomerStatus): StoreCustomer {
  return StoreCustomer.reconstitute({
    id: ID,
    tenantId: TENANT_ID,
    globalAuthId: AUTH_ID,
    name: 'Ana Gomez',
    email: 'ana@example.com',
    phone: '3001234567',
    documentId: '123456',
    address: makeAddress(),
    status,
    createdAt: T0,
    updatedAt: T0,
    version: 3,
  });
}

describe('StoreCustomer', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  describe('create', (): void => {
    it('creates an active customer at version 0 and emits StoreCustomerCreatedEvent', (): void => {
      const customer = makeCustomer();
      expect(customer.getStatus()).toBe(StoreCustomerStatus.ACTIVE);
      expect(customer.getVersion()).toBe(0);
      expect(customer.getCreatedAt()).toEqual(T0);
      expect(customer.getUpdatedAt()).toEqual(T0);
      expect(customer.getName()).toBe('Ana Gomez');
      expect(customer.getEmail()).toBe('ana@example.com');
      expect(customer.getPhone()).toBe('3001234567');
      expect(customer.getDocumentId()).toBe('123456');
      expect(customer.domainEvents).toHaveLength(1);
      expect(customer.domainEvents[0]).toMatchObject({
        eventName: 'StoreCustomerCreatedEvent',
        customerId: ID,
        tenantId: TENANT_ID,
        occurredOn: T0,
      });
    });

    it('rejects an empty customer id', (): void => {
      expect((): unknown =>
        StoreCustomer.create(
          '  ' as typeof ID,
          TENANT_ID,
          AUTH_ID,
          'n',
          'e',
          'p',
          'd',
          makeAddress(),
        ),
      ).toThrow(new InvalidStoreCustomerAttributeException('Store Customer ID is required.'));
    });

    it('rejects an empty tenant id', (): void => {
      expect((): unknown =>
        StoreCustomer.create(
          ID,
          '' as typeof TENANT_ID,
          AUTH_ID,
          'n',
          'e',
          'p',
          'd',
          makeAddress(),
        ),
      ).toThrow(InvalidTenantIdException);
      expect((): unknown =>
        StoreCustomer.create(
          ID,
          '' as typeof TENANT_ID,
          AUTH_ID,
          'n',
          'e',
          'p',
          'd',
          makeAddress(),
        ),
      ).toThrow('Tenant ID is required and must be a valid string.');
    });

    it('rejects an empty global auth id', (): void => {
      expect((): unknown =>
        StoreCustomer.create(
          ID,
          TENANT_ID,
          ' ' as typeof AUTH_ID,
          'n',
          'e',
          'p',
          'd',
          makeAddress(),
        ),
      ).toThrow(new InvalidStoreCustomerAttributeException('Global Auth ID is required.'));
    });
  });

  describe('suspend', (): void => {
    it('suspends an active customer, bumping version and updatedAt', (): void => {
      const customer = makeCustomer();
      vi.setSystemTime(T1);
      customer.suspend();
      expect(customer.getStatus()).toBe(StoreCustomerStatus.SUSPENDED);
      expect(customer.getVersion()).toBe(1);
      expect(customer.getUpdatedAt()).toEqual(T1);
    });

    it('suspends an inactive customer', (): void => {
      const customer = makeWithStatus(StoreCustomerStatus.INACTIVE);
      customer.suspend();
      expect(customer.getStatus()).toBe(StoreCustomerStatus.SUSPENDED);
      expect(customer.getVersion()).toBe(4);
    });

    it('is a no-op when already suspended (no throw, no version/updatedAt change)', (): void => {
      const customer = makeWithStatus(StoreCustomerStatus.SUSPENDED);
      vi.setSystemTime(T1);
      expect((): unknown => customer.suspend()).not.toThrow();
      expect(customer.getStatus()).toBe(StoreCustomerStatus.SUSPENDED);
      expect(customer.getVersion()).toBe(3);
      expect(customer.getUpdatedAt()).toEqual(T0);
    });
  });

  describe('activate', (): void => {
    it('activates a suspended customer, bumping version and updatedAt', (): void => {
      const customer = makeWithStatus(StoreCustomerStatus.SUSPENDED);
      vi.setSystemTime(T1);
      customer.activate();
      expect(customer.getStatus()).toBe(StoreCustomerStatus.ACTIVE);
      expect(customer.getVersion()).toBe(4);
      expect(customer.getUpdatedAt()).toEqual(T1);
    });

    it('activates an inactive customer', (): void => {
      const customer = makeWithStatus(StoreCustomerStatus.INACTIVE);
      customer.activate();
      expect(customer.getStatus()).toBe(StoreCustomerStatus.ACTIVE);
    });

    it('is a no-op when already active (no throw, no version/updatedAt change)', (): void => {
      const customer = makeCustomer();
      vi.setSystemTime(T1);
      expect((): unknown => customer.activate()).not.toThrow();
      expect(customer.getStatus()).toBe(StoreCustomerStatus.ACTIVE);
      expect(customer.getVersion()).toBe(0);
      expect(customer.getUpdatedAt()).toEqual(T0);
    });

    it('suspend then activate round-trips to active with version 2', (): void => {
      const customer = makeCustomer();
      customer.suspend();
      customer.activate();
      expect(customer.getStatus()).toBe(StoreCustomerStatus.ACTIVE);
      expect(customer.getVersion()).toBe(2);
    });
  });

  describe('reconstitute and events', (): void => {
    it('reconstitute emits no events and keeps props', (): void => {
      const customer = makeWithStatus(StoreCustomerStatus.SUSPENDED);
      expect(customer.domainEvents).toHaveLength(0);
      expect(customer.getId()).toBe(ID);
      expect(customer.getTenantId()).toBe(TENANT_ID);
      expect(customer.getGlobalAuthId()).toBe(AUTH_ID);
    });

    it('domainEvents returns a copy and clearDomainEvents empties the buffer', (): void => {
      const customer = makeCustomer();
      customer.domainEvents.length = 0;
      expect(customer.domainEvents).toHaveLength(1);
      customer.clearDomainEvents();
      expect(customer.domainEvents).toHaveLength(0);
    });
  });
});
