import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  SupabaseProductRepository,
  SupabaseProductReadRepository,
  PostgresProductRepository,
  PostgresTransactionManagerAdapter,
  CreateProductUseCase,
  UpdateProductUseCase,
  ArchiveProductUseCase,
  UnarchiveProductUseCase,
  PostgresEventBusAdapter,
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

function getEventBus(): PostgresEventBusAdapter {
  return new PostgresEventBusAdapter();
}

export function getTransactionManager(): PostgresTransactionManagerAdapter {
  return new PostgresTransactionManagerAdapter(sql);
}

export function getCreateProductUseCase(): CreateProductUseCase {
  return new CreateProductUseCase(
    getPostgresProductRepository(),
    getEventBus(),
    getTransactionManager(),
  );
}

export function getUpdateProductUseCase(): UpdateProductUseCase {
  return new UpdateProductUseCase(
    getPostgresProductRepository(),
    getEventBus(),
    getTransactionManager(),
  );
}

export function getUnarchiveProductUseCase(): UnarchiveProductUseCase {
  return new UnarchiveProductUseCase(
    getPostgresProductRepository(),
    getEventBus(),
    getTransactionManager(),
  );
}

export function getArchiveProductUseCase(): ArchiveProductUseCase {
  return new ArchiveProductUseCase(
    getPostgresProductRepository(),
    getEventBus(),
    getTransactionManager(),
  );
}

export function getStorageAdapter(): SupabaseStorageAdapter {
  return new SupabaseStorageAdapter();
}
