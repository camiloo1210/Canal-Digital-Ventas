import { Customer } from '@/customers/domain/entities/customer.entity';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';
import { CustomerId } from '@/customers/domain/types/customer-id.type';
import { TenantId } from '@/customers/domain/types/tenant-id.type';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';

export interface CustomerFilters {
  id?: CustomerId;
  status?: CustomerStatus[];
  tenantId: TenantId;
  searchTerm?: string;
}

export interface CustomerRepositoryPort {
  save(customer: Customer): Promise<void>;

  findById(id: CustomerId, tenantId: TenantId): Promise<Customer | null>;

  findByEmail(email: string, tenantId: TenantId): Promise<Customer | null>;

  findAll(tenantId: TenantId, pagination?: PaginationOptions): Promise<PaginatedResult<Customer>>;

  searchByFilters(
    filters: CustomerFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Customer>>;
}
