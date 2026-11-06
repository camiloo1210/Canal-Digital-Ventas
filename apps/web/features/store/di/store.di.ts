import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { sql } from '@/lib/postgres/server';
import {
  CachedPublicCategoryReadRepository,
  CachedPublicTenantReadRepository,
} from '@/features/store/infrastructure/cached-public-catalog-read.repositories';
import {
  SupabasePublicCategoryReadRepository,
  SupabasePublicProductReadRepository,
  SupabasePublicTenantReadAdapter,
  PostgresPublicProductPurchaseInfoReadRepository,
  type PublicProductPurchaseInfoReadRepositoryPort,
  PublicCategoryReadRepositoryPort,
  PublicProductReadRepositoryPort,
  PublicTenantReadRepositoryPort,
} from '@canaldigital/packages/core';

export async function getStoreTenantReadRepository(): Promise<PublicTenantReadRepositoryPort> {
  const supabase = await createClient();
  return new CachedPublicTenantReadRepository(new SupabasePublicTenantReadAdapter(supabase));
}

export async function getStoreCategoryReadRepository(): Promise<PublicCategoryReadRepositoryPort> {
  const supabase = await createClient();
  return new CachedPublicCategoryReadRepository(new SupabasePublicCategoryReadRepository(supabase));
}

export async function getStoreProductReadRepository(): Promise<PublicProductReadRepositoryPort> {
  const supabase = await createClient();
  // Wholesale fields depend on the current session and membership; never share this projection.
  return new SupabasePublicProductReadRepository(supabase);
}

export function getStorePurchaseInfoReadRepository(): PublicProductPurchaseInfoReadRepositoryPort {
  return new PostgresPublicProductPurchaseInfoReadRepository(sql);
}
