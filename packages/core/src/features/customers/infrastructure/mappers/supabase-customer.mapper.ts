import { Customer } from '@/customers/domain/entities/customer.entity';
import { DbCustomerRow } from '@/customers/infrastructure/types/supabase-customer.types';
import { CustomerId } from '@/customers/domain/types/customer-id.type';
import { TenantId } from '@/customers/domain/types/tenant-id.type';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';
import { CustomerName } from '@/customers/domain/value-objects/customer-name.vo';
import { Email } from '@/customers/domain/value-objects/email.vo';
import { PhoneNumber } from '@/customers/domain/value-objects/phone-number.vo';
import { DocumentId } from '@/customers/domain/value-objects/document-id.vo';
import { Address } from '@/shared/domain/value-objects/adress.vo';

export class SupabaseCustomerMapper {
  static toDomain(row: DbCustomerRow): Customer {
    let address: Address | null = null;
    if (row.address) {
      address = Address.create(
        row.address.street,
        row.address.city,
        row.address.state,
        row.address.zipCode,
        row.address.country,
        row.address.reference,
      );
    }

    return Customer.reconstitute({
      id: row.id as CustomerId,
      tenantId: row.tenant_id as TenantId,
      name: CustomerName.from(row.full_name),
      email: Email.from(row.email),
      phone: PhoneNumber.from(row.phone),
      documentId: DocumentId.from(row.document_id),
      status: row.status as CustomerStatus,
      address: address as Address,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version ?? 0,
    });
  }

  static toPersistence(customer: Customer): DbCustomerRow {
    return {
      id: customer.getId(),
      tenant_id: customer.getTenantId(),
      full_name: customer.getName().getValue(),
      email: customer.getEmail().getValue(),
      phone: customer.getPhone().getValue(),
      document_id: customer.getDocumentId().getValue(),
      status: customer.getStatus(),
      address: customer.getAddress()
        ? {
            street: customer.getAddress().getStreet(),
            city: customer.getAddress().getCity(),
            state: customer.getAddress().getState(),
            zipCode: customer.getAddress().getZipCode(),
            country: customer.getAddress().getCountry(),
            reference: customer.getAddress().getReference() || undefined,
          }
        : null,
      created_at: customer.getCreatedAt().toISOString(),
      updated_at: customer.getUpdatedAt().toISOString(),
      version: customer.getVersion(),
    };
  }
}
