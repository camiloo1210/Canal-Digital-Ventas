import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { SupabaseCategoryRepository } from '@canaldigital/packages/core';

export async function getCategoryRepository() {
  const supabase = await createClient();
  return new SupabaseCategoryRepository(supabase);
}
