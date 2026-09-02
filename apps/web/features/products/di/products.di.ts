import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { InMemoryEventBus } from '@/lib/infrastructure/event-bus/in-memory-event.bus';
import { SupabaseProductRepository, CreateProductUseCase } from '@canaldigital/packages/core';
import { SupabaseStorageAdapter } from '@/lib/storage/supabase-storage.adapter';

// Helper to get the repository (used for fast reads in Server Components)
export async function getProductRepository() {
  const supabase = await createClient();
  return new SupabaseProductRepository(supabase);
}

// Helper to get the Use Case (used in Server Actions)
export async function getCreateProductUseCase() {
  const repository = await getProductRepository();

  // Instantiate the Synchronous Event Bus
  // Here is where you would add subscriptions in the future (e.g. eventBus.subscribe(...))
  const eventBus = new InMemoryEventBus();

  return new CreateProductUseCase(repository, eventBus);
}

// Helper to get the Storage Adapter (used in Server Actions)
export function getStorageAdapter() {
  return new SupabaseStorageAdapter();
}
