import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  SupabasePublicCategoryReadRepository,
  SupabasePublicProductReadRepository,
  PublicCategoryReadRepositoryPort,
  PublicProductReadRepositoryPort
} from '@canaldigital/packages/core';

export async function getStoreCategoryReadRepository(): Promise<PublicCategoryReadRepositoryPort> {
  const supabase = await createClient();
  return new SupabasePublicCategoryReadRepository(supabase);
}

export async function getStoreProductReadRepository(): Promise<PublicProductReadRepositoryPort> {
  const supabase = await createClient();
  return new SupabasePublicProductReadRepository(supabase);
}
