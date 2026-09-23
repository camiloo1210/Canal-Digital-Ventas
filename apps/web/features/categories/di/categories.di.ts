import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  SupabaseCategoryRepository,
  SupabaseCategoryReadRepository,
  PostgresCategoryRepository,
  CreateCategoryUseCase,
  ChangeCategoryDetailsUseCase,
  ArchiveCategoryUseCase,
  UnarchiveCategoryUseCase,
  PostgresTransactionManagerAdapter,
  PostgresEventBusAdapter,
} from '@canaldigital/packages/core';
import { sql } from '@/lib/postgres/server';

export async function getCategoryRepository(): Promise<SupabaseCategoryRepository> {
  const supabase = await createClient();
  return new SupabaseCategoryRepository(supabase);
}

export async function getCategoryReadRepository(): Promise<SupabaseCategoryReadRepository> {
  const supabase = await createClient();
  return new SupabaseCategoryReadRepository(supabase);
}

export function getPostgresCategoryRepository(): PostgresCategoryRepository {
  return new PostgresCategoryRepository(sql);
}

function getEventBus(): PostgresEventBusAdapter {
  return new PostgresEventBusAdapter();
}

export function getTransactionManager(): PostgresTransactionManagerAdapter {
  return new PostgresTransactionManagerAdapter(sql);
}

export function getCreateCategoryUseCase(): CreateCategoryUseCase {
  return new CreateCategoryUseCase(
    getPostgresCategoryRepository(),
    getEventBus(),
    getTransactionManager(),
  );
}

export function getChangeCategoryDetailsUseCase(): ChangeCategoryDetailsUseCase {
  return new ChangeCategoryDetailsUseCase(
    getPostgresCategoryRepository(),
    getEventBus(),
    getTransactionManager(),
  );
}

export function getUnarchiveCategoryUseCase(): UnarchiveCategoryUseCase {
  return new UnarchiveCategoryUseCase(
    getPostgresCategoryRepository(),
    getEventBus(),
    getTransactionManager(),
  );
}

export function getArchiveCategoryUseCase(): ArchiveCategoryUseCase {
  return new ArchiveCategoryUseCase(
    getPostgresCategoryRepository(),
    getEventBus(),
    getTransactionManager(),
  );
}
