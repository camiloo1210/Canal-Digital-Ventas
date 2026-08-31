import { PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface SearchOrdersDto {
  id?: string;
  status?: string[];
  tenantId: string;
  pagination?: PaginationOptions;
}
