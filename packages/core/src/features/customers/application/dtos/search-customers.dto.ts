import { PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface SearchCustomersDto {
  tenantId: string;
  searchTerm?: string;
  status?: string[];
  pagination?: PaginationOptions;
}
