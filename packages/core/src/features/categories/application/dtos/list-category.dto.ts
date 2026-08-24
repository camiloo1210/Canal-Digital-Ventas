import { PaginationOptions } from '@/shared/domain/pagination/pagination';
import { TenantId } from '@/categories/domain/types/tenant-id.type';

export interface ListCategoriesDto {
  tenantId: TenantId;
  pagination?: PaginationOptions;
}
