import { PaginationOptions } from '@/shared/domain/pagination/pagination';
import { CategoryId } from '@/categories/domain/types/category-id.type';
import { TenantId } from '@/categories/domain/types/tenant-id.type';

export interface SearchCategoriesDto {
  id?: CategoryId;
  name?: string;
  tenantId: TenantId;
  status?: string;
  pagination?: PaginationOptions;
}
