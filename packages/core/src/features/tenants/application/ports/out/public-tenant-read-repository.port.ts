import { PublicTenantReadModel } from '@/tenants/application/read-models/public-tenant-read.model';

export interface PublicTenantReadRepositoryPort {
  findBySlug(slug: string): Promise<PublicTenantReadModel | null>;
}
