import { PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface ListCategoriesDto {
  tenantId: string;
  pagination?: PaginationOptions;
}
