import 'server-only';
import { sql } from '@/lib/postgres/server';
import { SupabaseStorageAdapter } from '@/lib/storage/supabase-storage.adapter';
import {
  PostgresTenantBrandingRepository,
  PostgresTenantBrandingReadRepository,
  UpdateTenantBrandingUseCase,
  SaveShippingOriginUseCase,
  PostgresShippingOriginRepository,
  type ShippingOriginRepositoryPort,
  PostgresTransactionManagerAdapter,
  PostgresEventBusAdapter,
  type TenantBrandingReadRepositoryPort,
} from '@canaldigital/packages/core';

export function getStoreSettingsReadRepository(): TenantBrandingReadRepositoryPort {
  return new PostgresTenantBrandingReadRepository(sql);
}

export function getUpdateStoreSettingsUseCase(): UpdateTenantBrandingUseCase {
  return new UpdateTenantBrandingUseCase(
    new PostgresTenantBrandingRepository(),
    new PostgresTransactionManagerAdapter(sql),
    new PostgresEventBusAdapter(),
  );
}

export function getStoreBrandingStorage(): SupabaseStorageAdapter {
  return new SupabaseStorageAdapter('store-branding');
}

export function getShippingOriginRepository(): ShippingOriginRepositoryPort {
  return new PostgresShippingOriginRepository(sql);
}

export function getSaveShippingOriginUseCase(): SaveShippingOriginUseCase {
  return new SaveShippingOriginUseCase(
    new PostgresShippingOriginRepository(sql),
    new PostgresTransactionManagerAdapter(sql),
  );
}
