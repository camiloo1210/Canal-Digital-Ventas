import { Product } from '@/products/domain/entities/product.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';

export interface ProductRepositoryPort {

    save(product: Product): Promise<void>;

    deleteById(id: string): Promise<void>;

    archive(id: string): Promise<void>;

    findById(id: string): Promise<Product | null>;

    findBySku(sku: string, tenantId: number): Promise<Product | null>;

    findAll(tenantId: number, pagination?: PaginationOptions): Promise<PaginatedResult<Product>>;

    findByCategory(categoryId: string, tenantId: number): Promise<Product[]>;


    findByStatus(status: ProductStatus, tenantId: number): Promise<Product[]>;


    findAvailable(tenantId: number): Promise<Product[]>;

    searchProductsByName(query: string, tenantId: number): Promise<Product[]>;
}