import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { InMemoryEventBus } from '@/lib/infrastructure/event-bus/in-memory-event.bus';
import {
  SupabaseProductRepository,
  SupabaseProductReadRepository,
  PostgresProductRepository,
  PostgresTransactionManagerAdapter,
  CreateProductUseCase,
  UpdateProductUseCase,
  ArchiveProductUseCase,
} from '@canaldigital/packages/core';
import { SupabaseStorageAdapter } from '@/lib/storage/supabase-storage.adapter';
import { sql } from '@/lib/postgres/server';

export async function getProductRepository(): Promise<SupabaseProductRepository> {
  const supabase = await createClient();
  return new SupabaseProductRepository(supabase);
}

export async function getProductReadRepository(): Promise<SupabaseProductReadRepository> {
  const supabase = await createClient();
  return new SupabaseProductReadRepository(supabase);
}

export function getPostgresProductRepository(): PostgresProductRepository {
  return new PostgresProductRepository(sql);
}

function getEventBus(): InMemoryEventBus {
  return new InMemoryEventBus();
}

export function getTransactionManager(): PostgresTransactionManagerAdapter {
  return new PostgresTransactionManagerAdapter(sql);
}

export async function getCreateProductUseCase(): Promise<CreateProductUseCase> {
  const repository = await getProductRepository();
  return new CreateProductUseCase(repository, getEventBus());
}

export async function getUpdateProductUseCase(): Promise<UpdateProductUseCase> {
  return new UpdateProductUseCase(
    getPostgresProductRepository(),
    getEventBus(),
    getTransactionManager(),
  );
}

export async function getArchiveProductUseCase(): Promise<ArchiveProductUseCase> {
  return new ArchiveProductUseCase(
    getPostgresProductRepository(),
    getEventBus(),
    getTransactionManager(),
  );
}

export function getStorageAdapter(): SupabaseStorageAdapter {
  return new SupabaseStorageAdapter();
}
