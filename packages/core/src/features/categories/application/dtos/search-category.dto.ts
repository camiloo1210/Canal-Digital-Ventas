import { PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface SearchCategoriesDto {
  id?: string;
  name?: string;
  tenantId: string;
  status?: string;
  pagination?: PaginationOptions;
}
