import { PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface SearchCategoriesDto {
  id?: string;
  name?: string;
  tenantId: number;
  status?: string;
  pagination?: PaginationOptions;
}
