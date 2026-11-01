import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  CachedPublicCategoryReadRepository,
  CachedPublicProductReadRepository,
  CachedPublicTenantReadRepository,
} from '@/features/store/infrastructure/cached-public-catalog-read.repositories';
import {
  SupabasePublicCategoryReadRepository,
  SupabasePublicProductReadRepository,
  SupabasePublicTenantReadAdapter,
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
  return new CachedPublicProductReadRepository(new SupabasePublicProductReadRepository(supabase));
}
