import { PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface SearchProductsDto {
    id?: string;
    name?: string;
    categoryId?: string;
    sku?: string;
    tenantId: number;
    status?: string;
    pagination?: PaginationOptions;
}

