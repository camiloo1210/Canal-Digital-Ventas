import { Product } from '@/products/domain/entities/product.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';

export interface ProductFilters {
    id?: string;
    name?: string;
    categoryId?: string;
    sku?: string;
    tenantId: number;
    status?: ProductStatus;
}

export interface ProductRepositoryPort {

    save(product: Product): Promise<void>;

    deleteById(id: string): Promise<void>;

    archive(id: string): Promise<void>;

    findById(id: string): Promise<Product | null>;

    findAll(tenantId: number, pagination?: PaginationOptions): Promise<PaginatedResult<Product>>;

    searchByFilters(filters: ProductFilters, pagination?: PaginationOptions): Promise<PaginatedResult<Product>>;

    findByCategoryId(categoryId: string, tenantId: number): Promise<Product[]>;

    searchProductsByName(query: string, tenantId: number): Promise<Product[]>;
}