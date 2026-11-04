export type {
  DashboardOverviewReadModel,
  DashboardOverviewReadPort,
} from '@/dashboard/application/ports/out/dashboard-overview-read.port';
export { PostgresDashboardOverviewReadAdapter } from '@/dashboard/infrastructure/postgres-dashboard-overview-read.adapter';
export type {
  ActiveMembershipSummary,
  ActiveTenantReadyContext,
  ActiveTenantContextReadModel,
  ActiveTenantContextReadPort,
} from '@/iam/application/ports/out/active-tenant-context-read.port';
export { SupabaseActiveTenantContextReadAdapter } from '@/iam/infrastructure/adapters/supabase-active-tenant-context-read.adapter';

export { Category } from '@/categories/domain/entities/category.entity';
export { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
export { CategoryName } from '@/categories/domain/value-objects/category-name.vo';
export { CategoryDescription } from '@/categories/domain/value-objects/category-description.vo';
export { InvalidCategoryStatusException } from '@/categories/domain/exceptions/invalid-category-status.exception';

export type {
  CategoryRepositoryPort,
  CategoryFilters,
} from '@/categories/application/ports/out/category-repository.port';

export { ArchiveCategoryUseCase } from '@/categories/application/use-cases/archive-category.use-case';
export { UnarchiveCategoryUseCase } from '@/categories/application/use-cases/unarchive-category.use-case';
export { CreateCategoryUseCase } from '@/categories/application/use-cases/create-category.use-case';
export { DeleteCategoryUseCase } from '@/categories/application/use-cases/delete-category.use-case';
export { ListCategoriesUseCase } from '@/categories/application/use-cases/list-categories.use-case';
export { SearchCategoryUseCase } from '@/categories/application/use-cases/search-category.use-case';
export { ChangeCategoryDetailsUseCase } from '@/categories/application/use-cases/change-category-details.use-case';
export { ChangeCategoryStatusUseCase } from '@/categories/application/use-cases/change-category-status.use-case';

export { SupabaseCategoryRepository } from '@/categories/infrastructure/repositories/supabase-category.repository';
export { SupabaseCategoryReadRepository } from '@/categories/infrastructure/repositories/supabase-category-read.repository';
export type { CategoryReadModel } from '@/categories/application/read-models/category-read.model';
export { PostgresCategoryRepository } from '@/categories/infrastructure/repositories/postgres-category.repository';

export { Product } from '@/products/domain/entities/product.entity';
export { ProductVariant } from '@/products/domain/entities/product-variant.entity';
export { ProductStatus } from '@/products/domain/enums/product-status.enum';
export type { ProductId } from '@/products/domain/types/product-id.type';
export type { CategoryId } from '@/products/domain/types/category-id.type';
export { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
export { InvalidProductStateException } from '@/products/domain/exceptions/invalid-product-state.exception';
export { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';
export { InvalidSeasonIdException } from '@/products/domain/exceptions/invalid-season-id.exception';

export type {
  ProductRepositoryPort,
  ProductFilters,
} from '@/products/application/ports/out/product-repository.port';

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

export type { CreateProductDto } from '@/products/application/dtos/create-product.dto';
export type { UpdateProductDto } from '@/products/application/dtos/update-product.dto';
export type { ArchiveProductDto } from '@/products/application/dtos/archive-product.dto';
export type { ChangeProductStatusDto } from '@/products/application/dtos/change-product-status.dto';
export type { ChangeProductDetailsDto } from '@/products/application/dtos/change-product-details.dto';
export type { ChangeProductPricingDto } from '@/products/application/dtos/change-product-pricing.dto';
export type { AdjustProductStockDto } from '@/products/application/dtos/adjust-product-stock.dto';
export type { UpdateProductImagesDto } from '@/products/application/dtos/update-product-images.dto';
export type { SetProductVariantsDto } from '@/products/application/dtos/set-product-variants.dto';

export { SupabaseProductRepository } from '@/products/infrastructure/repositories/supabase-product.repository';

export { SupabaseTenantRepository } from '@/tenants/infrastructure/repositories/supabase-tenant.repository';

export type { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';
export { DomainException } from '@/shared/domain/exceptions/domain.exception';
export { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
export { Money } from '@/shared/domain/value-objects/money.vo';
export type { DomainEvent } from '@/shared/domain/events/domain-event.interface';

export type { EventBusPort } from '@/shared/application/ports/out/event-bus.port';

export { ApplicationException } from '@/shared/application/exceptions/application.exception';
export { TransactionException } from '@/shared/application/exceptions/transaction.exception';

export { LocalEventBus } from '@/shared/infrastructure/event-bus/local-event-bus';

export { InvalidProviderException } from '@/iam/domain/exceptions/invalid-provider.exception';
export { InvalidCredentialsException } from '@/iam/domain/exceptions/invalid-credentials.exception';
export { InvalidPermissionException } from '@/iam/domain/exceptions/invalid-permission.exception';
export type { OAuthProvider } from '@/iam/domain/types/oauth-provider.type';

export { SignInWithEmailUseCase } from '@/iam/application/use-cases/sign-in-with-email.use-case';
export { GetOAuthSignInUrlUseCase } from '@/iam/application/use-cases/get-oauth-sign-in-url.use-case';
export { ExchangeOAuthCodeUseCase } from '@/iam/application/use-cases/exchange-oauth-code.use-case';
export { OnboardTenantUseCase } from '@/iam/application/use-cases/onboard-tenant.use-case';
export { RegisterGlobalIdentityUseCase } from '@/iam/application/use-cases/register-global-identity.use-case';
export type { RegisterGlobalIdentityDto } from '@/iam/application/dtos/register-global-identity.dto';

export { TenantNotConfiguredException } from '@/iam/application/exceptions/tenant-not-configured.exception';
export { AuthGatewayException } from '@/iam/application/exceptions/auth-gateway.exception';
export { AdminAuthException } from '@/iam/application/exceptions/admin-auth.exception';
export { UserRepositoryException } from '@/iam/application/exceptions/user-repository.exception';

export { SupabaseAuthAdapter } from '@/iam/infrastructure/adapters/supabase-auth.adapter';
export { SupabaseAdminAuthAdapter } from '@/iam/infrastructure/adapters/supabase-admin-auth.adapter';
export { SupabaseUserRepository } from '@/iam/infrastructure/repositories/supabase-user.repository';

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
export type { PublicProductDetailReadModel } from '@/products/application/read-models/public-product-detail-read.model';
export type {
  PublicProductFilters,
  PublicProductReadRepositoryPort,
} from '@/products/application/ports/out/public-product-read-repository.port';
export { SupabasePublicCategoryReadRepository } from '@/categories/infrastructure/repositories/supabase-public-category-read.repository';
export { SupabasePublicProductReadRepository } from '@/products/infrastructure/repositories/supabase-public-product-read.repository';
export type { PublicProductPurchaseInfoReadModel } from '@/products/application/read-models/public-product-purchase-info.model';
export type { PublicProductPurchaseInfoReadRepositoryPort } from '@/products/application/ports/out/public-product-purchase-info-read-repository.port';
export { PostgresPublicProductPurchaseInfoReadRepository } from '@/products/infrastructure/repositories/postgres-public-product-purchase-info-read.repository';
export * from '@/categories/domain/value-objects/category-slug.vo';

export type { PublicTenantReadModel } from '@/tenants/application/read-models/public-tenant-read.model';
export type { PublicTenantReadRepositoryPort } from '@/tenants/application/ports/out/public-tenant-read-repository.port';
export { SupabasePublicTenantReadAdapter } from '@/tenants/infrastructure/repositories/supabase-public-tenant-read.adapter';

export * from '@/tenants/application/read-models/public-tenant-directory-item.model';
export * from '@/tenants/application/ports/out/public-tenant-directory-read-repository.port';
export * from '@/tenants/infrastructure/repositories/supabase-public-tenant-directory-read.adapter';

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
export type {
  BusinessIntelligenceReport,
  IntelligenceQuery,
  IntelligenceProductResult,
  IntelligenceSignal,
} from '@/dashboard/domain/business-intelligence';
export type { BusinessIntelligenceReadPort } from '@/dashboard/application/ports/out/business-intelligence-read.port';
export { PostgresBusinessIntelligenceReadAdapter } from '@/dashboard/infrastructure/postgres-business-intelligence-read.adapter';
export { ConfigureKiviWhatsAppUseCase } from '@/kivi/application/use-cases/configure-kivi-whatsapp.use-case';
export { HttpKiviWhatsAppGateway } from '@/kivi/infrastructure/http-kivi-whatsapp.gateway';
export { KiviCredentialResolver } from '@/kivi/infrastructure/kivi-credential.resolver';
export { EnvKiviSecretResolver } from '@/kivi/infrastructure/env-kivi-secret.resolver';
export { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
export type { KiviWhatsAppResult } from '@/kivi/application/ports/out/kivi-whatsapp-gateway.port';
export {
  decodeKiviTokenEncryptionKey,
  loadKiviTokenCipher,
} from '@/kivi/infrastructure/aes-gcm-kivi-token.cipher';
export { PostgresKiviStoreWidgetReadRepository } from '@/kivi/infrastructure/postgres-kivi-store-widget-read.repository';
export type {
  KiviStoreWidget,
  KiviStoreWidgetReadPort,
} from '@/kivi/application/ports/out/kivi-store-widget-read.port';
export { ConfigureKiviNotificationsUseCase } from '@/kivi/application/use-cases/configure-kivi-notifications.use-case';
export { KiviMessagingReadRepository } from '@/kivi/infrastructure/kivi-messaging-read.repository';
export { HttpKiviNotificationSettingsGateway } from '@/kivi/infrastructure/http-kivi-notification-settings.gateway';
export type {
  KiviMessagingReadPort,
  KiviMessagingStatus,
  KiviDeliverySummary,
  KiviNotificationSettings,
} from '@/kivi/application/ports/out/kivi-messaging.port';

// Kivi knowledge base (HU-17): documents published as RAG sources for the chatbot.
export {
  ConfigureKiviKnowledgeUseCase,
  KIVI_KNOWLEDGE_KIND,
  KIVI_KNOWLEDGE_MAX_DOCUMENTS,
  kiviKnowledgeDisplayName,
  kiviKnowledgeDocumentId,
  type ConfigureKiviKnowledgeDto,
} from '@/kivi/application/use-cases/configure-kivi-knowledge.use-case';
export { KiviKnowledgeLimitException } from '@/kivi/application/exceptions/kivi-knowledge-limit.exception';
export { HttpKiviKnowledgeGateway } from '@/kivi/infrastructure/http-kivi-knowledge.gateway';
export { KiviKnowledgeReadRepository } from '@/kivi/infrastructure/kivi-knowledge-read.repository';
export type {
  KiviKnowledgeReadPort,
  KiviKnowledgeResource,
  KiviKnowledgeStatus,
} from '@/kivi/application/ports/out/kivi-knowledge-gateway.port';

// Kivi order lookup (HU-16): signed, read-only endpoint for "where is my order?".
export { PostgresKiviOrderLookupReadRepository } from '@/kivi/infrastructure/postgres-kivi-order-lookup-read.repository';
export { KiviOrderLookupReadException } from '@/kivi/infrastructure/kivi-order-lookup-read.exception';
export {
  deriveKiviOrderLookupKey,
  signKiviOrderLookup,
  verifyKiviOrderLookupSignature,
  type KiviOrderLookupSignatureInput,
} from '@/kivi/infrastructure/kivi-order-lookup-signature';
export type {
  KiviOrderLookupItem,
  KiviOrderLookupQuery,
  KiviOrderLookupReadPort,
} from '@/kivi/application/ports/out/kivi-order-lookup-read.port';

// Kivi connection tools: live, read-only lookups Kivi calls on behalf of the chatbot.
export {
  deriveKiviToolsKey,
  signKiviTools,
  verifyKiviToolsSignature,
  type KiviToolsSignatureInput,
} from '@/kivi/infrastructure/kivi-tools-signature';
export {
  KIVI_TOOL_CATALOG,
  KIVI_TOOLS_PATH,
  GET_PRODUCT_DETAILS_TOOL,
  type KiviToolDefinition,
  type KiviToolParameter,
} from '@/kivi/application/kivi-tool-catalog';
export { publicHttpsOrigin } from '@/kivi/application/kivi-public-origin';
export { HttpKiviToolsGateway } from '@/kivi/infrastructure/http-kivi-tools.gateway';
export type {
  KiviToolsGatewayPort,
  KiviToolsRegistration,
  KiviToolsRegistrationResult,
} from '@/kivi/application/ports/out/kivi-tools-gateway.port';
export {
  RegisterKiviToolsUseCase,
  type KiviToolsRegistrar,
  type RegisterKiviToolsDto,
  type RegisterKiviToolsOutcome,
} from '@/kivi/application/use-cases/register-kivi-tools.use-case';
export { PostgresKiviProductLookupReadRepository } from '@/kivi/infrastructure/postgres-kivi-product-lookup-read.repository';
export { KiviProductLookupReadException } from '@/kivi/infrastructure/kivi-product-lookup-read.exception';
export type {
  KiviProductAvailability,
  KiviProductLookupItem,
  KiviProductLookupQuery,
  KiviProductLookupReadPort,
} from '@/kivi/application/ports/out/kivi-product-lookup-read.port';
export {
  BUYER_CART_TTL_DAYS,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
} from '@/carts/domain/policies/buyer-cart-limits';
export type {
  BuyerCartItemInputDto,
  GetBuyerCartDto,
  SyncBuyerCartDto,
  MergeBuyerCartDto,
  CompleteBuyerCartDto,
} from '@/carts/application/dtos/buyer-cart.dto';
export type {
  BuyerCartItemReadModel,
  BuyerCartReadModel,
  BuyerCartDropReason,
  BuyerCartDroppedItem,
  BuyerCartSyncResult,
} from '@/carts/application/read-models/buyer-cart.read-model';
export type {
  BuyerCartRepositoryPort,
  BuyerCartRecord,
  BuyerCartStoredLine,
} from '@/carts/application/ports/out/buyer-cart-repository.port';
export type {
  BuyerCartCatalogReadPort,
  BuyerCartCatalogProduct,
} from '@/carts/application/ports/out/buyer-cart-catalog-read.port';
export { CartVersionConflictException } from '@/carts/application/exceptions/cart-version-conflict.exception';
export { BuyerCartStoreNotFoundException } from '@/carts/application/exceptions/buyer-cart-store-not-found.exception';
export { InvalidBuyerCartInputException } from '@/carts/application/exceptions/invalid-buyer-cart-input.exception';
export { BuyerCartRepositoryException } from '@/carts/application/exceptions/buyer-cart-repository.exception';
export { GetBuyerCartUseCase } from '@/carts/application/use-cases/get-buyer-cart.use-case';
export { SyncBuyerCartUseCase } from '@/carts/application/use-cases/sync-buyer-cart.use-case';
export { MergeBuyerCartUseCase } from '@/carts/application/use-cases/merge-buyer-cart.use-case';
export { CompleteBuyerCartUseCase } from '@/carts/application/use-cases/complete-buyer-cart.use-case';
export { PostgresBuyerCartRepository } from '@/carts/infrastructure/postgres/postgres-buyer-cart.repository';
export { PostgresBuyerCartCatalogReadRepository } from '@/carts/infrastructure/postgres/postgres-buyer-cart-catalog-read.repository';
export { loadCartRetentionWorkerConfig } from '@/carts/infrastructure/cart-retention-worker-config';
export { runCartRetentionWorker } from '@/carts/infrastructure/cart-retention-worker';

// User management: custom tenant roles, invitations, own profile, demographics (HU-18..21).
export { UserPermission } from '@/iam/domain/enums/permission.enum';
export { resolveEffectivePermissions } from '@/iam/domain/effective-permissions';
export {
  INVITATION_DEFAULT_EXPIRY_DAYS,
  INVITATION_MAX_EXPIRY_DAYS,
  INVITATION_MAX_USES_LIMIT,
} from '@/iam/domain/entities/invitation.entity';
export {
  INVITATION_ACCOUNT_MODES,
  DEFAULT_INVITATION_ACCOUNT_MODE,
  parseInvitationAccountMode,
  type InvitationAccountMode,
} from '@/iam/domain/value-objects/invitation-account-mode.vo';
export {
  StaffEmailGenerator,
  slugifyPersonName,
  isGeneratedStaffEmailOf,
  STAFF_EMAIL_DOMAIN_SUFFIX,
} from '@/iam/domain/services/staff-email-generator';
export {
  CreateStaffAccountUseCase,
  type CreateStaffAccountDto,
  type CreateStaffAccountResult,
} from '@/iam/application/use-cases/create-staff-account.use-case';
export { EmailAlreadyRegisteredException } from '@/iam/application/exceptions/email-already-registered.exception';
export { StaffAccountConfirmationRequiredException } from '@/iam/application/exceptions/staff-account-confirmation-required.exception';
export { StaffEmailGenerationExhaustedException } from '@/iam/application/exceptions/staff-email-generation-exhausted.exception';
export type { AdminAuthPort } from '@/iam/application/ports/out/admin-auth.port';
export type { AuthPort } from '@/iam/application/ports/out/auth.port';
export { AGE_RANGES, type AgeRangeValue } from '@/iam/domain/value-objects/age-range.vo';
export { GENDERS, type GenderValue } from '@/iam/domain/value-objects/gender.vo';
export { PROVINCES, type ProvinceValue } from '@/iam/domain/value-objects/province.vo';
export { InvalidTenantRoleException } from '@/iam/domain/exceptions/invalid-tenant-role.exception';
export { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';
export { InvitationNotUsableException } from '@/iam/domain/exceptions/invitation-not-usable.exception';
export { InvalidDemographicBucketException } from '@/iam/domain/exceptions/invalid-demographic-bucket.exception';
export { InvalidPersonNameException } from '@/shared/domain/exceptions/invalid-person-name.exception';
export { UserManagementForbiddenException } from '@/iam/application/exceptions/user-management-forbidden.exception';
export { TenantRoleNotFoundException } from '@/iam/application/exceptions/tenant-role-not-found.exception';
export { TenantRoleNameTakenException } from '@/iam/application/exceptions/tenant-role-name-taken.exception';
export { TenantRoleInUseException } from '@/iam/application/exceptions/tenant-role-in-use.exception';
export { InvitationNotFoundException } from '@/iam/application/exceptions/invitation-not-found.exception';
export { MemberNotFoundException } from '@/iam/application/exceptions/member-not-found.exception';
export { ProtectedMemberException } from '@/iam/application/exceptions/protected-member.exception';
export { MemberNotActiveException } from '@/iam/application/exceptions/member-not-active.exception';
export { BusinessAccountBoundException } from '@/iam/application/exceptions/business-account-bound.exception';
export { AlreadyMemberException } from '@/iam/application/exceptions/already-member.exception';
export { UserManagementRepositoryException } from '@/iam/application/exceptions/user-management-repository.exception';
export {
  DEMOGRAPHIC_MIN_BUCKET_SIZE,
  DEMOGRAPHIC_MIN_TOTAL_SAMPLES,
} from '@/iam/application/demographic-k-anonymity';

export {
  CreateTenantRoleUseCase,
  type CreateTenantRoleDto,
} from '@/iam/application/use-cases/create-tenant-role.use-case';
export {
  UpdateTenantRoleUseCase,
  type UpdateTenantRoleDto,
} from '@/iam/application/use-cases/update-tenant-role.use-case';
export {
  DeleteTenantRoleUseCase,
  type DeleteTenantRoleDto,
} from '@/iam/application/use-cases/delete-tenant-role.use-case';
export {
  CreateInvitationUseCase,
  type CreateInvitationDto,
  type CreateInvitationResult,
} from '@/iam/application/use-cases/create-invitation.use-case';
export {
  RevokeInvitationUseCase,
  type RevokeInvitationDto,
} from '@/iam/application/use-cases/revoke-invitation.use-case';
export {
  AcceptInvitationUseCase,
  type AcceptInvitationDto,
} from '@/iam/application/use-cases/accept-invitation.use-case';
export {
  AssignMemberRoleUseCase,
  type AssignMemberRoleDto,
} from '@/iam/application/use-cases/assign-member-role.use-case';
export {
  UpdateOwnProfileUseCase,
  type UpdateOwnProfileDto,
} from '@/iam/application/use-cases/update-own-profile.use-case';
export { GetInvitationPreviewUseCase } from '@/iam/application/use-cases/get-invitation-preview.use-case';
export {
  UnlinkMemberUseCase,
  type UnlinkMemberDto,
  type UnlinkMemberResult,
} from '@/iam/application/use-cases/unlink-member.use-case';
export {
  SetMemberActiveUseCase,
  type SetMemberActiveDto,
} from '@/iam/application/use-cases/set-member-active.use-case';
export {
  ResetManagedAccountPasswordUseCase,
  MANAGED_PASSWORD_MIN_LENGTH,
  type ResetManagedAccountPasswordDto,
  type ResetManagedAccountPasswordResult,
} from '@/iam/application/use-cases/reset-managed-account-password.use-case';
export {
  RenameManagedAccountUseCase,
  type RenameManagedAccountDto,
} from '@/iam/application/use-cases/rename-managed-account.use-case';
export { PersonalAccountProtectedException } from '@/iam/application/exceptions/personal-account-protected.exception';
export { AdminAuthUnavailableException } from '@/iam/application/exceptions/admin-auth-unavailable.exception';
export { InvalidManagedPasswordException } from '@/iam/domain/exceptions/invalid-managed-password.exception';

export type { SessionRevocationPort } from '@/iam/application/ports/out/session-revocation.port';
export type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
export type { TenantRoleRepositoryPort } from '@/iam/application/ports/out/tenant-role-repository.port';
export type { InvitationRepositoryPort } from '@/iam/application/ports/out/invitation-repository.port';
export type { MembershipRepositoryPort } from '@/iam/application/ports/out/membership-repository.port';
export type { UserProfileRepositoryPort } from '@/iam/application/ports/out/user-profile-repository.port';
export type { SignupDemographicsPort } from '@/iam/application/ports/out/signup-demographics.port';
export {
  RecordSignupDemographicsUseCase,
  type RecordSignupDemographicsDto,
} from '@/iam/application/use-cases/record-signup-demographics.use-case';
export { PostgresSignupDemographicsAdapter } from '@/iam/infrastructure/postgres/postgres-signup-demographics.adapter';
export type { InvitationAcceptancePort } from '@/iam/application/ports/out/invitation-acceptance.port';
export type { TokenGeneratorPort } from '@/iam/application/ports/out/token-generator.port';
export type { TenantRoleReadPort } from '@/iam/application/ports/out/tenant-role-read.port';
export type { InvitationReadPort } from '@/iam/application/ports/out/invitation-read.port';
export type { MemberDirectoryReadPort } from '@/iam/application/ports/out/member-directory-read.port';
export type { DemographicStatsReadPort } from '@/iam/application/ports/out/demographic-stats-read.port';
export type { BusinessAccountReadPort } from '@/iam/application/ports/out/business-account-read.port';
export type { InvitationPreviewReadPort } from '@/iam/application/ports/out/invitation-preview-read.port';
export type { OwnProfileReadPort } from '@/iam/application/ports/out/own-profile-read.port';
export type { MemberPermissionsReadPort } from '@/iam/application/ports/out/member-permissions-read.port';
export type {
  TenantRoleReadModel,
  InvitationReadModel,
  InvitationViewStatus,
  MemberReadModel,
  DemographicBucketCount,
  DemographicDimensionStats,
  DemographicStatsReadModel,
  InvitationPreviewReadModel,
  MemberPermissionsReadModel,
  OwnProfileReadModel,
} from '@/iam/application/read-models/user-management.read-models';

export { NodeCryptoTokenGenerator } from '@/iam/infrastructure/node-crypto-token.generator';
export { PostgresSessionRevocationAdapter } from '@/iam/infrastructure/postgres/postgres-session-revocation.adapter';
export { PostgresTenantOwnershipAdapter } from '@/iam/infrastructure/postgres/postgres-tenant-ownership.adapter';
export { PostgresTenantRoleRepository } from '@/iam/infrastructure/postgres/postgres-tenant-role.repository';
export { PostgresInvitationRepository } from '@/iam/infrastructure/postgres/postgres-invitation.repository';
export { PostgresMembershipRepository } from '@/iam/infrastructure/postgres/postgres-membership.repository';
export { PostgresUserProfileRepository } from '@/iam/infrastructure/postgres/postgres-user-profile.repository';
export { PostgresBusinessAccountReadRepository } from '@/iam/infrastructure/postgres/postgres-business-account-read.repository';
export { PostgresInvitationAcceptanceAdapter } from '@/iam/infrastructure/postgres/postgres-invitation-acceptance.adapter';
export {
  PostgresTenantRoleReadRepository,
  PostgresInvitationReadRepository,
  PostgresMemberDirectoryReadRepository,
  PostgresDemographicStatsReadRepository,
  PostgresInvitationPreviewReadRepository,
  PostgresMemberPermissionsReadRepository,
  PostgresOwnProfileReadRepository,
} from '@/iam/infrastructure/postgres/postgres-user-management-read.repositories';
