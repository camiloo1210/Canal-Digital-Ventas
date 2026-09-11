import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import {
  CreateCategoryUseCase,
  SupabaseCategoryRepository,
  CategoryRepositoryPort,
  SupabaseProductRepository,
  ProductRepositoryPort,
} from '@canaldigital/packages/core';

async function createSupabaseClient() {
  const cookieStore = await cookies();

  // Environment variables must be asserted as strings in a real-world production app
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

// Repositories for CQRS-lite Data Fetching
export async function getCategoryRepository(): Promise<CategoryRepositoryPort> {
  const supabaseClient = await createSupabaseClient();
  return new SupabaseCategoryRepository(supabaseClient);
}

export async function getProductRepository(): Promise<ProductRepositoryPort> {
  const supabaseClient = await createSupabaseClient();
  return new SupabaseProductRepository(supabaseClient);
}

// Use Cases for Mutations
export async function getCreateCategoryUseCase(): Promise<CreateCategoryUseCase> {
  const supabaseClient = await createSupabaseClient();
  const repository = new SupabaseCategoryRepository(supabaseClient);

  // Dummy EventBus implementation for now, as it's typically injected via DI container
  const eventBus = {
    publish: async () => {},
  };

  return new CreateCategoryUseCase(repository, eventBus);
}
