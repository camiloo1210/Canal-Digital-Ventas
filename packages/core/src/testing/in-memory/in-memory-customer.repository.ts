import { Customer, type CustomerProps } from '@/customers/domain/entities/customer.entity';
import type {
  CustomerFilters,
  CustomerRepositoryPort,
} from '@/customers/application/ports/out/customer-repository.port';
import { createCustomerId, type CustomerId } from '@/customers/domain/types/customer-id.type';
import { createTenantId, type TenantId } from '@/shared/domain/types/tenant-id.type';
import { CustomerName } from '@/customers/domain/value-objects/customer-name.vo';
import { Email } from '@/customers/domain/value-objects/email.vo';
import { PhoneNumber } from '@/customers/domain/value-objects/phone-number.vo';
import { DocumentId } from '@/customers/domain/value-objects/document-id.vo';
import type { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

function snapshotOf(customer: Customer): CustomerProps {
  return {
    id: createCustomerId(customer.getId()),
    tenantId: createTenantId(customer.getTenantId()),
    name: CustomerName.from(customer.getName().getValue()),
    email: Email.from(customer.getEmail().getValue()),
    phone: PhoneNumber.from(customer.getPhone().getValue()),
    documentId: DocumentId.from(customer.getDocumentId().getValue()),
    status: customer.getStatus(),
    address: customer.getAddress(),
    createdAt: new Date(customer.getCreatedAt()),
    updatedAt: new Date(customer.getUpdatedAt()),
    version: customer.getVersion(),
  };
}

function paginate<T>(items: T[], pagination?: PaginationOptions): PaginatedResult<T> {
  if (!pagination) {
    return { items, totalItems: items.length, totalPages: 1, currentPage: 1 };
  }
  const start = (pagination.page - 1) * pagination.limit;
  return {
    items: items.slice(start, start + pagination.limit),
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pagination.limit)),
    currentPage: pagination.page,
  };
}

/**
 * Tenant-scoped in-memory repository. Stores snapshots: `save` copies, every read returns a
 * fresh instance without domain events. Insertion order is the listing order. It does NOT
 * enforce email or document uniqueness (the port contract does not), so duplicate handling is
 * observable from the use case alone.
 */
export class InMemoryCustomerRepository implements CustomerRepositoryPort {
  private readonly store = new Map<string, CustomerProps>();
  public saveCount = 0;

  private static key(tenantId: string, customerId: string): string {
    return `${tenantId}::${customerId}`;
  }

  /** Test setup helper: stores a snapshot without counting as a `save`. */
  public seed(...customers: Customer[]): void {
    for (const customer of customers) {
      this.store.set(
        InMemoryCustomerRepository.key(customer.getTenantId(), customer.getId()),
        snapshotOf(customer),
      );
    }
  }

  private inTenant(tenantId: TenantId): Customer[] {
    return [...this.store.values()]
      .filter((props): boolean => props.tenantId === tenantId)
      .map((props): Customer => Customer.reconstitute(props));
  }

  async save(customer: Customer): Promise<void> {
    this.saveCount++;
    this.seed(customer);
  }

  async findById(id: CustomerId, tenantId: TenantId): Promise<Customer | null> {
    const props = this.store.get(InMemoryCustomerRepository.key(tenantId, id));
    return props ? Customer.reconstitute(props) : null;
  }

  async findByEmail(email: string, tenantId: TenantId): Promise<Customer | null> {
    const wanted = email.trim().toLowerCase();
    return (
      this.inTenant(tenantId).find(
        (customer): boolean => customer.getEmail().getValue() === wanted,
      ) ?? null
    );
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Customer>> {
    return paginate(this.inTenant(tenantId), pagination);
  }

  async searchByFilters(
    filters: CustomerFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Customer>> {
    const term = filters.searchTerm?.toLowerCase();
    const matches = this.inTenant(filters.tenantId).filter(
      (customer): boolean =>
        (filters.id === undefined || customer.getId() === filters.id) &&
        (filters.status === undefined ||
          filters.status.length === 0 ||
          filters.status.includes(customer.getStatus())) &&
        (term === undefined ||
          customer.getName().getValue().toLowerCase().includes(term) ||
          customer.getEmail().getValue().includes(term)),
    );
    return paginate(matches, pagination);
  }
}
