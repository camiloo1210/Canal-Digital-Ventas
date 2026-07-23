import { PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface ListProductsDto {
    tenantId: number;
    pagination?: PaginationOptions;
}
