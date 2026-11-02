import type { PublicProductPurchaseInfoReadModel } from '@/products/application/read-models/public-product-purchase-info.model';

export interface PublicProductPurchaseInfoReadRepositoryPort {
  findActive(params: {
    tenantSlug: string;
    productId: string;
  }): Promise<PublicProductPurchaseInfoReadModel | null>;
}
