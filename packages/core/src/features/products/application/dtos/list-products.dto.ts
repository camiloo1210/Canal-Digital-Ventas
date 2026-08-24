import { PaginationOptions } from '@/shared/domain/pagination/pagination';
import { TenantId } from '@/products/domain/types/tenant-id.type';

export interface ListProductsDto {
  tenantId: TenantId;
  pagination?: PaginationOptions;
}
