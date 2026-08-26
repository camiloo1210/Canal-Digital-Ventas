import { TenantId } from '@/customers/domain/types/tenant-id.type';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';
import { PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface SearchCustomersDto {
  tenantId: TenantId;
  searchTerm?: string;
  status?: CustomerStatus[];
  pagination?: PaginationOptions;
}
