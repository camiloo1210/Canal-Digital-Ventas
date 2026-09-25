// ==========================================
// CATEGORIES EXPORTS
// ==========================================

// Domain
export { Category } from '@/categories/domain/entities/category.entity';
export { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
export { CategoryName } from '@/categories/domain/value-objects/category-name.vo';
export { CategoryDescription } from '@/categories/domain/value-objects/category-description.vo';
export { InvalidCategoryStatusException } from '@/categories/domain/exceptions/invalid-category-status.exception';

// Application (Ports)
export type {
  CategoryRepositoryPort,
  CategoryFilters,
} from '@/categories/application/ports/out/category-repository.port';

// Application (Use Cases)
export { ArchiveCategoryUseCase } from '@/categories/application/use-cases/archive-category.use-case';
export { UnarchiveCategoryUseCase } from '@/categories/application/use-cases/unarchive-category.use-case';
export { CreateCategoryUseCase } from '@/categories/application/use-cases/create-category.use-case';
export { DeleteCategoryUseCase } from '@/categories/application/use-cases/delete-category.use-case';
export { ListCategoriesUseCase } from '@/categories/application/use-cases/list-categories.use-case';
export { SearchCategoryUseCase } from '@/categories/application/use-cases/search-category.use-case';
export { ChangeCategoryDetailsUseCase } from '@/categories/application/use-cases/change-category-details.use-case';
export { ChangeCategoryStatusUseCase } from '@/categories/application/use-cases/change-category-status.use-case';

// Infrastructure
export { SupabaseCategoryRepository } from '@/categories/infrastructure/repositories/supabase-category.repository';
export { SupabaseCategoryReadRepository } from '@/categories/infrastructure/repositories/supabase-category-read.repository';
export type { CategoryReadModel } from '@/categories/infrastructure/repositories/supabase-category-read.repository';
export { PostgresCategoryRepository } from '@/categories/infrastructure/repositories/postgres-category.repository';

// ==========================================
// PRODUCTS EXPORTS
// ==========================================

// Domain
export { Product } from '@/products/domain/entities/product.entity';
export { ProductVariant } from '@/products/domain/entities/product-variant.entity';
export { ProductStatus } from '@/products/domain/enums/product-status.enum';
export type { ProductId } from '@/products/domain/types/product-id.type';
export type { CategoryId } from '@/products/domain/types/category-id.type';
export { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
export { InvalidProductStateException } from '@/products/domain/exceptions/invalid-product-state.exception';
export { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';
export { InvalidSeasonIdException } from '@/products/domain/exceptions/invalid-season-id.exception';

// Application (Ports)
export type {
  ProductRepositoryPort,
  ProductFilters,
} from '@/products/application/ports/out/product-repository.port';

// Application (Use Cases)
export { ArchiveProductUseCase } from '@/products/application/use-cases/archive-product.use-case';
export { UnarchiveProductUseCase } from '@/products/application/use-cases/unarchive-product.use-case';
export { CreateProductUseCase } from '@/products/application/use-cases/create-product.use-case';
export { DeleteProductUseCase } from '@/products/application/use-cases/delete-product.use-case';
export { ListProductsUseCase } from '@/products/application/use-cases/list-products.use-case';
export { SearchProductsUseCase } from '@/products/application/use-cases/search-products.use-case';
export { ChangeProductPricingUseCase } from '@/products/application/use-cases/change-product-pricing.use-case';
export { ChangeProductDetailsUseCase } from '@/products/application/use-cases/change-product-details.use-case';
export { AdjustProductStockUseCase } from '@/products/application/use-cases/adjust-product-stock.use-case';
export { ChangeProductStatusUseCase } from '@/products/application/use-cases/change-product-status.use-case';
export { UpdateProductImagesUseCase } from '@/products/application/use-cases/update-product-images.use-case';
export { SetProductVariantsUseCase } from '@/products/application/use-cases/set-product-variants.use-case';
export { UpdateProductUseCase } from '@/products/application/use-cases/update-product.use-case';

// Application (DTOs)
export type { CreateProductDto } from '@/products/application/dtos/create-product.dto';
export type { UpdateProductDto } from '@/products/application/dtos/update-product.dto';
export type { ArchiveProductDto } from '@/products/application/dtos/archive-product.dto';
export type { ChangeProductStatusDto } from '@/products/application/dtos/change-product-status.dto';
export type { ChangeProductDetailsDto } from '@/products/application/dtos/change-product-details.dto';
export type { ChangeProductPricingDto } from '@/products/application/dtos/change-product-pricing.dto';
export type { AdjustProductStockDto } from '@/products/application/dtos/adjust-product-stock.dto';
export type { UpdateProductImagesDto } from '@/products/application/dtos/update-product-images.dto';
export type { SetProductVariantsDto } from '@/products/application/dtos/set-product-variants.dto';

// Infrastructure
export { SupabaseProductRepository } from '@/products/infrastructure/repositories/supabase-product.repository';

// ==========================================
// TENANTS EXPORTS
// ==========================================

// Infrastructure
export { SupabaseTenantRepository } from '@/tenants/infrastructure/repositories/supabase-tenant.repository';

// ==========================================
// SHARED EXPORTS
// ==========================================

// Domain
export type { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';
export { DomainException } from '@/shared/domain/exceptions/domain.exception';
export { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
export { Money } from '@/shared/domain/value-objects/money.vo';
export type { DomainEvent } from '@/shared/domain/events/domain-event.interface';

// Application (Ports)
export type { EventBusPort } from '@/shared/application/ports/out/event-bus.port';

// Application (Exceptions)
export { ApplicationException } from '@/shared/application/exceptions/application.exception';
export { TransactionException } from '@/shared/application/exceptions/transaction.exception';

// Infrastructure
export { LocalEventBus } from '@/shared/infrastructure/event-bus/local-event-bus';

// ==========================================
// IAM EXPORTS
// ==========================================

// Domain
export { InvalidProviderException } from '@/iam/domain/exceptions/invalid-provider.exception';
export { InvalidPermissionException } from '@/iam/domain/exceptions/invalid-permission.exception';
export type { OAuthProvider } from '@/iam/domain/types/oauth-provider.type';

// Application (Use Cases)
export { SignInWithEmailUseCase } from '@/iam/application/use-cases/sign-in-with-email.use-case';
export { GetOAuthSignInUrlUseCase } from '@/iam/application/use-cases/get-oauth-sign-in-url.use-case';
export { ExchangeOAuthCodeUseCase } from '@/iam/application/use-cases/exchange-oauth-code.use-case';
export { OnboardTenantUseCase } from '@/iam/application/use-cases/onboard-tenant.use-case';
export { RegisterGlobalIdentityUseCase } from '@/iam/application/use-cases/register-global-identity.use-case';
export type { RegisterGlobalIdentityDto } from '@/iam/application/dtos/register-global-identity.dto';

// Application (Exceptions)
export { TenantNotConfiguredException } from '@/iam/application/exceptions/tenant-not-configured.exception';
export { AuthGatewayException } from '@/iam/application/exceptions/auth-gateway.exception';
export { AdminAuthException } from '@/iam/application/exceptions/admin-auth.exception';
export { UserRepositoryException } from '@/iam/application/exceptions/user-repository.exception';

// Infrastructure
export { SupabaseAuthAdapter } from '@/iam/infrastructure/adapters/supabase-auth.adapter';
export { SupabaseAdminAuthAdapter } from '@/iam/infrastructure/adapters/supabase-admin-auth.adapter';
export { SupabaseUserRepository } from '@/iam/infrastructure/repositories/supabase-user.repository';

// ==========================================
// SHARED EXPORTS (Outbox)
// ==========================================
export type { OutboxPort, OutboxEvent } from '@/shared/application/ports/out/outbox.port';
export { SupabaseOutboxAdapter } from '@/shared/infrastructure/adapters/supabase-outbox.adapter';
export { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
export type { TransactionManagerPort, TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
export type { DomainEventEnvelope } from '@/shared/application/ports/out/event-bus.port';
export { SupabaseProductReadRepository } from '@/products/infrastructure/repositories/supabase-product-read.repository';
export type { ProductReadModel } from '@/products/infrastructure/repositories/supabase-product-read.repository';
export { PostgresProductRepository } from '@/products/infrastructure/repositories/postgres-product.repository';
export { PostgresTransactionManagerAdapter } from '@/shared/infrastructure/adapters/postgres-transaction-manager.adapter';
export * from '@/shared/infrastructure/adapters/postgres-event-bus.adapter';
export { createTenantId } from '@/shared/domain/types/tenant-id.type';
export { createCategoryId } from '@/products/domain/types/category-id.type';
export type { PublicCategoryReadModel } from '@/categories/application/read-models/public-category-read.model';
export type { PublicCategoryReadRepositoryPort } from '@/categories/application/ports/out/public-category-read-repository.port';
export type { PublicProductReadModel } from '@/products/application/read-models/public-product-read.model';
export type { PublicProductFilters, PublicProductReadRepositoryPort } from '@/products/application/ports/out/public-product-read-repository.port';
export { SupabasePublicCategoryReadRepository } from '@/categories/infrastructure/repositories/supabase-public-category-read.repository';
export { SupabasePublicProductReadRepository } from '@/products/infrastructure/repositories/supabase-public-product-read.repository';
export * from './features/categories/domain/value-objects/category-slug.vo';

// Public Tenant
export type { PublicTenantReadModel } from '@/tenants/application/read-models/public-tenant-read.model';
export type { PublicTenantReadRepositoryPort } from '@/tenants/application/ports/out/public-tenant-read-repository.port';
export { SupabasePublicTenantReadAdapter } from '@/tenants/infrastructure/repositories/supabase-public-tenant-read.adapter';


// Tenant Directory
export * from './features/tenants/application/read-models/public-tenant-directory-item.model';
export * from './features/tenants/application/ports/out/public-tenant-directory-read-repository.port';
export * from './features/tenants/infrastructure/repositories/supabase-public-tenant-directory-read.adapter';
