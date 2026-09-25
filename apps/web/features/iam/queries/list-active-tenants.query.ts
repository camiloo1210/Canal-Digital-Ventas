import 'server-only';
import { getStoreDirectoryReadRepository } from '@/features/store-directory/di/directory.di';
import { PublicTenantDirectoryResult } from '@canaldigital/packages/core';

export async function listActiveTenantsQuery(page: number = 1, limit: number = 24): Promise<PublicTenantDirectoryResult> {
  const repository = await getStoreDirectoryReadRepository();
  return repository.listActive(page, limit);
}
