import { PublicCategoryReadModel } from '@/categories/application/read-models/public-category-read.model';

export interface PublicCategoryReadRepositoryPort {
  searchActiveByTenantSlug(tenantSlug: string): Promise<PublicCategoryReadModel[]>;
}
