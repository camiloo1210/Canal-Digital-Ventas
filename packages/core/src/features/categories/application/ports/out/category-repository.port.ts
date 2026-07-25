import { Category } from "@/categories/domain/entities/category.entity";
import { PaginationOptions, PaginatedResult } from "@/shared/domain/pagination/pagination";
import { CategoryStatus } from "@/categories/domain/enums/category-status.enum";

export interface CategoryFilters {
    id?: string;
    name?: string;
    tenantId: number;
    status?: CategoryStatus;
}

export interface CategoryRepositoryPort {
    save(category: Category): Promise<void>;

    deleteById(id: string): Promise<void>;

    archive(id: string): Promise<void>;

    findById(id: string): Promise<Category | null>;

    findAll(tenantId: number, pagination?: PaginationOptions): Promise<PaginatedResult<Category>>;

    searchByFilters(filters: CategoryFilters, pagination?: PaginationOptions): Promise<PaginatedResult<Category>>;

    searchCategoriesByName(query: string, tenantId: number): Promise<Category[]>;
}