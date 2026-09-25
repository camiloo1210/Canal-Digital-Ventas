import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  PublicTenantDirectoryReadRepositoryPort,
  SupabasePublicTenantDirectoryReadAdapter
} from '@canaldigital/packages/core';

export async function getStoreDirectoryReadRepository(): Promise<PublicTenantDirectoryReadRepositoryPort> {
  const supabase = await createClient();
  return new SupabasePublicTenantDirectoryReadAdapter(supabase);
}
