import { Customer, type CustomerProps } from '@/customers/domain/entities/customer.entity';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';
import { createCustomerId } from '@/customers/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CustomerName } from '@/customers/domain/value-objects/customer-name.vo';
import { Email } from '@/customers/domain/value-objects/email.vo';
import { PhoneNumber } from '@/customers/domain/value-objects/phone-number.vo';
import { DocumentId } from '@/customers/domain/value-objects/document-id.vo';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import { DEFAULT_TEST_TENANT_ID } from '@/testing/builders/product.builder';

/** Valid, event-free customer (reconstituted). Deterministic: no clock, no random ids. */
export function buildCustomer(overrides: Partial<CustomerProps> = {}): Customer {
  return Customer.reconstitute({
    id: createCustomerId('customer-1'),
    tenantId: createTenantId(DEFAULT_TEST_TENANT_ID),
    name: CustomerName.from('Ana Perez'),
    email: Email.from('ana@example.com'),
    phone: PhoneNumber.from('+57 300 1234567'),
    documentId: DocumentId.from('CC-100200300'),
    status: CustomerStatus.ACTIVE,
    address: Address.create('Calle 1 # 2-3', 'Bogota', 'Cundinamarca', '110111', 'CO'),
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
    updatedAt: new Date('2026-01-15T12:00:00.000Z'),
    version: 0,
    ...overrides,
  });
}
