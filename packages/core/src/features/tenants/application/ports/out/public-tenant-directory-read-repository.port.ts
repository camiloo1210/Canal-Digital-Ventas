import { PublicTenantDirectoryResult } from '@/tenants/application/read-models/public-tenant-directory-item.model';

export interface PublicTenantDirectoryReadRepositoryPort {
  listActive(page: number, limit: number): Promise<PublicTenantDirectoryResult>;
}

export interface PublicTenantDirectorySearchRepositoryPort {
  searchActive(page: number, limit: number, query: string): Promise<PublicTenantDirectoryResult>;
}
