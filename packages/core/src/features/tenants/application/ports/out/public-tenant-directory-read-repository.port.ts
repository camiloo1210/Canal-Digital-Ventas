import { PublicTenantDirectoryResult } from '../../read-models/public-tenant-directory-item.model';

export interface PublicTenantDirectoryReadRepositoryPort {
  listActive(page: number, limit: number): Promise<PublicTenantDirectoryResult>;
}
