// ==========================================
// CATEGORIES EXPORTS
// ==========================================

// Domain
export { Category } from './features/categories/domain/entities/category.entity';
export { CategoryStatus } from './features/categories/domain/enums/category-status.enum';
export { CategoryName } from './features/categories/domain/value-objects/category-name.vo';
export { CategoryDescription } from './features/categories/domain/value-objects/category-description.vo';
export { InvalidCategoryStatusException } from './features/categories/domain/exceptions/invalid-category-status.exception';

// Application (Ports)
export type {
  CategoryRepositoryPort,
  CategoryFilters,
} from './features/categories/application/ports/out/category-repository.port';

// Application (Use Cases)
export { ArchiveCategoryUseCase } from './features/categories/application/use-cases/archive-category.use-case';
export { CreateCategoryUseCase } from './features/categories/application/use-cases/create-category.use-case';
export { DeleteCategoryUseCase } from './features/categories/application/use-cases/delete-category.use-case';
export { ListCategoriesUseCase } from './features/categories/application/use-cases/list-categories.use-case';
export { SearchCategoryUseCase } from './features/categories/application/use-cases/search-category.use-case';
export { UpdateCategoryUseCase } from './features/categories/application/use-cases/update-category.use-case';

// Infrastructure
export { SupabaseCategoryRepository } from './features/categories/infrastructure/repositories/supabase-category.repository';

// ==========================================
// PRODUCTS EXPORTS
// ==========================================

// Domain
export { Product } from './features/products/domain/entities/product.entity';
export { ProductVariant } from './features/products/domain/entities/product-variant.entity';
export { ProductStatus } from './features/products/domain/enums/product-status.enum';

// Application (Ports)
export type {
  ProductRepositoryPort,
  ProductFilters,
} from './features/products/application/ports/out/product-repository.port';

// Application (Use Cases)
export { ArchiveProductUseCase } from './features/products/application/use-cases/archive-product.use-case';
export { CreateProductUseCase } from './features/products/application/use-cases/create-product.use-case';
export { DeleteProductUseCase } from './features/products/application/use-cases/delete-product.use-case';
export { ListProductsUseCase } from './features/products/application/use-cases/list-products.use-case';
export { SearchProductsUseCase } from './features/products/application/use-cases/search-products.use-case';
export { UpdateProductUseCase } from './features/products/application/use-cases/update-product-use-case';

// Infrastructure
export { SupabaseProductRepository } from './features/products/infrastructure/repositories/supabase-product.repository';

// ==========================================
// SHARED EXPORTS
// ==========================================

// Domain
export type {
  PaginatedResult,
  PaginationOptions,
} from './features/shared/domain/pagination/pagination';
export { DomainException } from './features/shared/domain/exceptions/domain.exception';
export { InvalidTenantIdException } from './features/shared/domain/exceptions/invalid-tenant-id.exception';
export { Money } from './features/shared/domain/value-objects/money.vo';
