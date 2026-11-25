import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Customer } from '@/customers/domain/entities/customer.entity';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';
import { createCustomerId, CustomerId } from '@/customers/domain/types/customer-id.type';
import { createTenantId, TenantId } from '@/shared/domain/types/tenant-id.type';
import { CustomerName } from '@/customers/domain/value-objects/customer-name.vo';
import { Email } from '@/customers/domain/value-objects/email.vo';
import { PhoneNumber } from '@/customers/domain/value-objects/phone-number.vo';
import { DocumentId } from '@/customers/domain/value-objects/document-id.vo';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';
import { InvalidCustomerStateException } from '@/customers/domain/exceptions/invalid-customer-state.exception';

const CREATED_AT = new Date('2026-01-15T12:00:00.000Z');
const LATER = new Date('2026-01-16T08:30:00.000Z');

const customerId = createCustomerId('customer-1');
const tenantId = createTenantId('tenant-1');

function makeAddress(street: string = 'Calle 1'): Address {
  return Address.create(street, 'Bogota', 'Cundinamarca', '110111', 'CO');
}

function makeCustomer(status: CustomerStatus = CustomerStatus.ACTIVE): Customer {
  return Customer.reconstitute({
    id: customerId,
    tenantId,
    name: CustomerName.from('Ana Perez'),
    email: Email.from('ana@example.com'),
    phone: PhoneNumber.from('+57 300 1234567'),
    documentId: DocumentId.from('CC12345678'),
    status,
    address: makeAddress(),
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    version: 3,
  });
}

describe('Customer', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(CREATED_AT);
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  describe('create', (): void => {
    it('creates an active customer at version 0 with one creation event', (): void => {
      const customer = Customer.create(
        customerId,
        tenantId,
        CustomerName.from('Ana Perez'),
        Email.from('ana@example.com'),
        PhoneNumber.from('+57 300 1234567'),
        DocumentId.from('CC12345678'),
        makeAddress(),
      );

      expect(customer.getStatus()).toBe(CustomerStatus.ACTIVE);
      expect(customer.getVersion()).toBe(0);
      expect(customer.getCreatedAt()).toEqual(CREATED_AT);
      expect(customer.getUpdatedAt()).toEqual(CREATED_AT);
      expect(customer.domainEvents).toHaveLength(1);
      expect(customer.domainEvents[0]).toMatchObject({
        eventName: 'CustomerCreatedEvent',
        customerId,
        occurredOn: CREATED_AT,
      });
    });

    it.each([
      ['blank customer id', '   ' as CustomerId, tenantId, makeAddress()],
      ['empty customer id', '' as CustomerId, tenantId, makeAddress()],
      ['blank tenant id', customerId, '  ' as TenantId, makeAddress()],
      ['empty tenant id', customerId, '' as TenantId, makeAddress()],
      ['missing address', customerId, tenantId, null as unknown as Address],
    ])('rejects %s', (_label: string, id: CustomerId, tenant: TenantId, address: Address): void => {
      expect((): Customer =>
        Customer.create(
          id,
          tenant,
          CustomerName.from('Ana Perez'),
          Email.from('ana@example.com'),
          PhoneNumber.from('+57 300 1234567'),
          DocumentId.from('CC12345678'),
          address,
        ),
      ).toThrow(DomainException);
    });
  });

  describe('status transitions', (): void => {
    const statuses: CustomerStatus[] = [
      CustomerStatus.ACTIVE,
      CustomerStatus.INACTIVE,
      CustomerStatus.SUSPENDED,
    ];
    const actions: {
      name: 'suspend' | 'activate' | 'deactivate';
      target: CustomerStatus;
      message: string;
      eventName: string;
    }[] = [
      {
        name: 'suspend',
        target: CustomerStatus.SUSPENDED,
        message: 'Customer is already suspended.',
        eventName: 'CustomerSuspendedEvent',
      },
      {
        name: 'activate',
        target: CustomerStatus.ACTIVE,
        message: 'Customer is already active.',
        eventName: 'CustomerActivatedEvent',
      },
      {
        name: 'deactivate',
        target: CustomerStatus.INACTIVE,
        message: 'Customer is already inactive.',
        eventName: 'CustomerDeactivatedEvent',
      },
    ];

    for (const action of actions) {
      for (const from of statuses) {
        if (from === action.target) {
          it(`${action.name} from ${from} throws and changes nothing`, (): void => {
            const customer = makeCustomer(from);
            expect((): void => customer[action.name]()).toThrow(InvalidCustomerStateException);
            expect((): void => customer[action.name]()).toThrow(action.message);
            expect(customer.getStatus()).toBe(from);
            expect(customer.getVersion()).toBe(3);
            expect(customer.domainEvents).toHaveLength(0);
          });
        } else {
          it(`${action.name} from ${from} moves to ${action.target} and emits one event`, (): void => {
            const customer = makeCustomer(from);
            vi.setSystemTime(LATER);
            customer[action.name]();
            expect(customer.getStatus()).toBe(action.target);
            expect(customer.getUpdatedAt()).toEqual(LATER);
            expect(customer.getVersion()).toBe(4);
            expect(customer.domainEvents).toHaveLength(1);
            expect(customer.domainEvents[0]).toMatchObject({
              eventName: action.eventName,
              customerId,
            });
          });
        }
      }
    }
  });

  describe('updateProfile', (): void => {
    it('updates name and phone, refreshes updatedAt and emits one event', (): void => {
      const customer = makeCustomer();
      vi.setSystemTime(LATER);
      customer.updateProfile(CustomerName.from('Beatriz Gomez'), PhoneNumber.from('3109876543'));

      expect(customer.getName().getValue()).toBe('Beatriz Gomez');
      expect(customer.getPhone().getValue()).toBe('3109876543');
      expect(customer.getUpdatedAt()).toEqual(LATER);
      expect(customer.domainEvents).toHaveLength(1);
      expect(customer.domainEvents[0]).toMatchObject({ eventName: 'CustomerProfileUpdatedEvent' });
    });

    it('rejects a suspended customer and leaves the profile unchanged', (): void => {
      const customer = makeCustomer(CustomerStatus.SUSPENDED);
      expect((): void =>
        customer.updateProfile(CustomerName.from('Beatriz Gomez'), PhoneNumber.from('3109876543')),
      ).toThrow(InvalidCustomerStateException);
      expect(customer.getName().getValue()).toBe('Ana Perez');
      expect(customer.getPhone().getValue()).toBe('+57 300 1234567');
      expect(customer.getUpdatedAt()).toEqual(CREATED_AT);
      expect(customer.domainEvents).toHaveLength(0);
    });

    it('currently allows an inactive customer to update the profile', (): void => {
      const customer = makeCustomer(CustomerStatus.INACTIVE);
      customer.updateProfile(CustomerName.from('Beatriz Gomez'), PhoneNumber.from('3109876543'));
      expect(customer.getName().getValue()).toBe('Beatriz Gomez');
      expect(customer.getStatus()).toBe(CustomerStatus.INACTIVE);
    });
  });

  describe('changeAddress', (): void => {
    it('replaces the address, refreshes updatedAt and emits one event', (): void => {
      const customer = makeCustomer();
      const newAddress = makeAddress('Carrera 7');
      vi.setSystemTime(LATER);
      customer.changeAddress(newAddress);

      expect(customer.getAddress()).toBe(newAddress);
      expect(customer.getUpdatedAt()).toEqual(LATER);
      expect(customer.domainEvents).toHaveLength(1);
      expect(customer.domainEvents[0]).toMatchObject({ eventName: 'CustomerAddressChangedEvent' });
    });

    it('rejects a suspended customer and leaves the address unchanged', (): void => {
      const customer = makeCustomer(CustomerStatus.SUSPENDED);
      const original = customer.getAddress();
      expect((): void => customer.changeAddress(makeAddress('Carrera 7'))).toThrow(
        InvalidCustomerStateException,
      );
      expect(customer.getAddress()).toBe(original);
      expect(customer.domainEvents).toHaveLength(0);
    });

    it('currently allows an inactive customer to change the address', (): void => {
      const customer = makeCustomer(CustomerStatus.INACTIVE);
      const newAddress = makeAddress('Carrera 7');
      customer.changeAddress(newAddress);
      expect(customer.getAddress()).toBe(newAddress);
    });

    it('rejects a missing address', (): void => {
      const customer = makeCustomer();
      expect((): void => customer.changeAddress(null as unknown as Address)).toThrow(
        DomainException,
      );
    });
  });

  describe('domain events', (): void => {
    it('clearDomainEvents empties the event list', (): void => {
      const customer = makeCustomer();
      customer.suspend();
      expect(customer.domainEvents).toHaveLength(1);
      customer.clearDomainEvents();
      expect(customer.domainEvents).toHaveLength(0);
    });

    it('returns a copy so callers cannot mutate internal events', (): void => {
      const customer = makeCustomer();
      customer.suspend();
      customer.domainEvents.length = 0;
      expect(customer.domainEvents).toHaveLength(1);
    });
  });
});
