import 'server-only';
import { sql } from '@/lib/postgres/server';
import {
  type PublicTenantDirectorySearchRepositoryPort,
  PostgresPublicTenantDirectoryReadAdapter,
} from '@canaldigital/packages/core';

export async function getStoreDirectoryReadRepository(): Promise<PublicTenantDirectorySearchRepositoryPort> {
  return new PostgresPublicTenantDirectoryReadAdapter(sql);
}
