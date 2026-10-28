// CATEGORIES EXPORTS
export type {
  DashboardOverviewReadModel,
  DashboardOverviewReadPort,
} from '@/dashboard/application/ports/out/dashboard-overview-read.port';
export { PostgresDashboardOverviewReadAdapter } from '@/dashboard/infrastructure/postgres-dashboard-overview-read.adapter';
export type {
  ActiveTenantContextReadModel,
  ActiveTenantContextReadPort,
} from '@/iam/application/ports/out/active-tenant-context-read.port';
export { SupabaseActiveTenantContextReadAdapter } from '@/iam/infrastructure/adapters/supabase-active-tenant-context-read.adapter';

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
export type { CategoryReadModel } from '@/categories/application/read-models/category-read.model';
export { PostgresCategoryRepository } from '@/categories/infrastructure/repositories/postgres-category.repository';

// PRODUCTS EXPORTS

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

// TENANTS EXPORTS

// Infrastructure
export { SupabaseTenantRepository } from '@/tenants/infrastructure/repositories/supabase-tenant.repository';

// SHARED EXPORTS

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

// IAM EXPORTS

// Domain
export { InvalidProviderException } from '@/iam/domain/exceptions/invalid-provider.exception';
export { InvalidCredentialsException } from '@/iam/domain/exceptions/invalid-credentials.exception';
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

// SHARED EXPORTS (Outbox)
export type { OutboxPort, OutboxEvent } from '@/shared/application/ports/out/outbox.port';
export { SupabaseOutboxAdapter } from '@/shared/infrastructure/adapters/supabase-outbox.adapter';
export { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
export type {
  TransactionManagerPort,
  TransactionContext,
} from '@/shared/application/ports/out/transaction-manager.port';
export type { DomainEventEnvelope } from '@/shared/application/ports/out/event-bus.port';
export { SupabaseProductReadRepository } from '@/products/infrastructure/repositories/supabase-product-read.repository';
export type { ProductReadModel } from '@/products/application/read-models/product-read.model';
export { PostgresProductRepository } from '@/products/infrastructure/repositories/postgres-product.repository';
export { PostgresTransactionManagerAdapter } from '@/shared/infrastructure/adapters/postgres-transaction-manager.adapter';
export * from '@/shared/infrastructure/adapters/postgres-event-bus.adapter';
export { createTenantId } from '@/shared/domain/types/tenant-id.type';
export type { TenantId } from '@/shared/domain/types/tenant-id.type';
export { createCategoryId } from '@/products/domain/types/category-id.type';
export type { PublicCategoryReadModel } from '@/categories/application/read-models/public-category-read.model';
export type { PublicCategoryReadRepositoryPort } from '@/categories/application/ports/out/public-category-read-repository.port';
export type {
  PublicProductReadModel,
  PublicStockAvailability,
} from '@/products/application/read-models/public-product-read.model';
export type {
  PublicProductFilters,
  PublicProductReadRepositoryPort,
} from '@/products/application/ports/out/public-product-read-repository.port';
export { SupabasePublicCategoryReadRepository } from '@/categories/infrastructure/repositories/supabase-public-category-read.repository';
export { SupabasePublicProductReadRepository } from '@/products/infrastructure/repositories/supabase-public-product-read.repository';
export * from '@/categories/domain/value-objects/category-slug.vo';

// Public Tenant
export type { PublicTenantReadModel } from '@/tenants/application/read-models/public-tenant-read.model';
export type { PublicTenantReadRepositoryPort } from '@/tenants/application/ports/out/public-tenant-read-repository.port';
export { SupabasePublicTenantReadAdapter } from '@/tenants/infrastructure/repositories/supabase-public-tenant-read.adapter';

// Tenant Directory
export * from '@/tenants/application/read-models/public-tenant-directory-item.model';
export * from '@/tenants/application/ports/out/public-tenant-directory-read-repository.port';
export * from '@/tenants/infrastructure/repositories/supabase-public-tenant-directory-read.adapter';

// ORDERS EXPORTS
export { GenerateCommercialOrderUseCase } from '@/orders/application/use-cases/generate-commercial-order.use-case';
export type { GenerateCommercialOrderDto } from '@/orders/application/dtos/generate-commercial-order.dto';
export { CancelOrderUseCase } from '@/orders/application/use-cases/cancel-order.use-case';
export { ChangeOrderStatusUseCase } from '@/orders/application/use-cases/change-order-status.use-case';
export { UnsupportedOrderStatusException } from '@/orders/application/exceptions/unsupported-order-status.exception';
export { PostgresSellerOrderAccessAdapter } from '@/orders/infrastructure/repositories/postgres-seller-order-access.adapter';
export { PostgresSellerOrderReadRepository } from '@/orders/infrastructure/repositories/postgres-seller-order-read.repository';
export type { SellerOrderReadRepositoryPort } from '@/orders/application/ports/out/seller-order-read-repository.port';
export type {
  SellerOrderReadModel,
  SellerOrderPage,
} from '@/orders/application/read-models/seller-order.read-model';
export type { CancelOrderDto } from '@/orders/application/dtos/cancel-order.dto';
export { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
export { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
export { PostgresOrderRepository } from '@/orders/infrastructure/repositories/postgres-order.repository';
export { PostgresOrderPaymentCoordinationAdapter } from '@/orders/infrastructure/repositories/postgres-order-payment-coordination.adapter';
export { PostgresOrderTenantRepository } from '@/orders/infrastructure/repositories/postgres-order-tenant.repository';
export { TenantNotAvailableException } from '@/orders/application/exceptions/tenant-not-available.exception';
export { PostgresStoreCustomerRepository } from '@/sales/infrastructure/repositories/postgres-store-customer.repository';
export * from '@/sales/application/ports/out/store-customer-repository.port';

// Buyer Orders CQRS-Lite Read Models & Repositories
export type {
  BuyerOrderReadModel,
  BuyerOrderItemReadModel,
} from '@/orders/application/read-models/buyer-order.read-model';
export type { BuyerOrderReadRepositoryPort } from '@/orders/application/ports/out/buyer-order-read-repository.port';
export { PostgresBuyerOrderReadRepository } from '@/orders/infrastructure/repositories/postgres-buyer-order-read.repository';
export { ORDER_AGGREGATE_TYPE } from '@/orders/application/outbox/order-aggregate.constants';

export * from '@/products/application/exceptions/product-out-of-stock.exception';
export * from '@/products/application/exceptions/product-unavailable.exception';

// Reliable integration messaging (driven by apps/worker, never by web requests).
export type {
  IntegrationEvent,
  IntegrationEventPublisherPort,
} from '@/shared/application/ports/out/integration-event-publisher.port';
export type { RelayOutboxPort } from '@/shared/application/ports/out/relay-outbox.port';
export { RelayOutboxUseCase } from '@/shared/application/use-cases/relay-outbox.use-case';
export { MessagingException } from '@/shared/application/exceptions/messaging.exception';
export { OutboxRelayException } from '@/shared/application/exceptions/outbox-relay.exception';
export { PostgresRelayOutboxAdapter } from '@/shared/infrastructure/adapters/postgres-relay-outbox.adapter';
export { RabbitMqEventPublisherAdapter } from '@/shared/infrastructure/adapters/rabbitmq-event-publisher.adapter';
export { loadMessagingWorkerConfig } from '@/shared/infrastructure/messaging/messaging-worker-config';
export type { MessagingWorkerConfig } from '@/shared/infrastructure/messaging/messaging-worker-config';
export { runOutboxWorker } from '@/shared/infrastructure/messaging/outbox-worker';
export { ORDER_NOTIFICATION_EVENT_TYPES } from '@/notifications/application/notification-events';
export { loadSmtpConfig } from '@/notifications/infrastructure/smtp-config';
export { runNotificationWorker } from '@/notifications/infrastructure/notification-worker';

// Payment delivery adapters. Financial authority remains in core and restricted RPCs.
export { StartPaymentCheckoutUseCase } from '@/payments/application/use-cases/start-payment-checkout.use-case';
export { IngestPaymentWebhookUseCase } from '@/payments/application/use-cases/ingest-payment-webhook.use-case';
export { PaymentCheckoutException } from '@/payments/application/exceptions/payment-checkout.exception';
export { LemonSqueezyCheckoutAdapter } from '@/payments/infrastructure/adapters/lemon-squeezy-checkout.adapter';
export { PostgresPaymentCheckoutRepository } from '@/payments/infrastructure/adapters/postgres-payment-checkout.repository';
export { PostgresPaymentWebhookInboxAdapter } from '@/payments/infrastructure/adapters/postgres-payment-webhook-inbox.adapter';
export type { PaymentEnvironment } from '@/payments/application/ports/out/provider-checkout.port';
export type { StartPaymentCheckoutResult } from '@/payments/application/use-cases/start-payment-checkout.use-case';
export { ProcessPaymentInboxUseCase } from '@/payments/application/use-cases/process-payment-inbox.use-case';
export { loadPaymentWorkerConfig } from '@/payments/infrastructure/payment-worker-config';
export { runPaymentInboxWorker } from '@/payments/infrastructure/payment-inbox-worker';
export {
  runPaymentOrderWorker,
  PAYMENT_ORDER_EVENT_TYPES,
} from '@/orders/infrastructure/payment-order-worker';
export {
  runPaymentRefundDispatchWorker,
  runPaymentReconciliationWorker,
} from '@/payments/infrastructure/payment-refund-workers';
export {
  runPaymentEvidenceWorker,
  runPaymentRetentionWorker,
} from '@/payments/infrastructure/payment-evidence-worker';
export { UpdateTenantBrandingUseCase } from '@/tenants/application/use-cases/update-tenant-branding.use-case';
export {
  PostgresTenantBrandingRepository,
  PostgresTenantBrandingReadRepository,
} from '@/tenants/infrastructure/repositories/postgres-tenant-branding.repository';
export type { TenantBrandingReadRepositoryPort } from '@/tenants/application/ports/out/tenant-branding-repository.port';
export type { TenantBrandingReadModel } from '@/tenants/application/read-models/tenant-branding.read-model';
export { TenantSlugAlreadyInUseException } from '@/tenants/application/exceptions/tenant-slug-already-in-use.exception';
export { PostgresPublicTenantDirectoryReadAdapter } from '@/tenants/infrastructure/repositories/postgres-public-tenant-directory-read.adapter';
export type { PublicTenantDirectorySearchRepositoryPort } from '@/tenants/application/ports/out/public-tenant-directory-read-repository.port';

export type {
  CatalogStatus,
  AdminCatalogQuery,
  AdminProductCatalogItem,
  AdminCategoryCatalogItem,
  AdminCatalogPage,
  AdminCatalogReadPort,
} from '@/dashboard/application/ports/out/admin-catalog-read.port';
export { PostgresAdminCatalogReadAdapter } from '@/dashboard/infrastructure/postgres-admin-catalog-read.adapter';

export type { ProductFormContextReadModel } from '@/dashboard/application/ports/out/admin-catalog-read.port';

export type { ProductReadRepositoryPort } from '@/products/application/ports/out/product-read-repository.port';

export type { CategoryReadRepositoryPort } from '@/categories/application/ports/out/category-read-repository.port';

export type { SellerOrderFilters } from '@/orders/application/read-models/seller-order.read-model';

// Kivi connector: store <-> Kivi link use cases (web) and the catalog sync worker.
export { LinkStoreToKiviUseCase } from '@/kivi/application/use-cases/link-store-to-kivi.use-case';
export { UnlinkStoreFromKiviUseCase } from '@/kivi/application/use-cases/unlink-store-from-kivi.use-case';
export { PairStoreWithKiviUseCase } from '@/kivi/application/use-cases/pair-store-with-kivi.use-case';
export type { UnlinkStoreFromKiviDependencies } from '@/kivi/application/use-cases/unlink-store-from-kivi.use-case';
export { InvalidKiviPairingCodeException } from '@/kivi/application/exceptions/invalid-kivi-pairing-code.exception';
export {
  KiviPairingException,
  type KiviPairingFailure,
} from '@/kivi/application/exceptions/kivi-pairing.exception';
export { KiviConfigurationException } from '@/kivi/infrastructure/kivi-configuration.exception';
export { HttpKiviPairingGateway } from '@/kivi/infrastructure/http-kivi-pairing.gateway';
export {
  loadKiviPlatformConfig,
  type KiviPlatformConfig,
} from '@/kivi/infrastructure/kivi-platform-config';
export type {
  LinkStoreToKiviDto,
  PairStoreWithKiviDto,
  UnlinkStoreFromKiviDto,
} from '@/kivi/application/dtos/kivi-connection.dto';
export type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
export { KiviLinkForbiddenException } from '@/kivi/application/exceptions/kivi-link-forbidden.exception';
export { KiviConnectionNotFoundException } from '@/kivi/application/exceptions/kivi-connection-not-found.exception';
export { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';
export { RequestKiviSyncUseCase } from '@/kivi/application/use-cases/request-kivi-sync.use-case';
export type { RequestKiviSyncDto } from '@/kivi/application/dtos/kivi-connection.dto';
export type {
  KiviConnectionReadModel,
  KiviConnectionReadRepositoryPort,
} from '@/kivi/application/ports/out/kivi-connection-read.port';
export { PostgresKiviConnectionReadRepository } from '@/kivi/infrastructure/postgres-kivi-connection-read.repository';
export { PostgresKiviConnectionRepository } from '@/kivi/infrastructure/postgres-kivi-connection.repository';
export { loadKiviSyncWorkerConfig } from '@/kivi/infrastructure/kivi-sync-worker-config';
export { runKiviSyncWorker } from '@/kivi/infrastructure/kivi-sync-worker';
