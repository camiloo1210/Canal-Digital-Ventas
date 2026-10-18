import { StoreCustomer } from '@/sales/domain/entities/store-customer.entity';
import { DbStoreCustomerRow } from '@/sales/infrastructure/types/supabase-customer.types';
import { StoreCustomerId } from '@/sales/domain/types/customer-id.type';
import { GlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { StoreCustomerStatus } from '@/sales/domain/enums/store-customer-status.enum';

export class SupabaseStoreCustomerMapper {
  static toDomain(row: DbStoreCustomerRow): StoreCustomer {
    return StoreCustomer.reconstitute({
      id: row.id as StoreCustomerId,
      tenantId: row.tenant_id as TenantId,
      globalAuthId: row.global_auth_id as GlobalAuthId,
      status: row.status as StoreCustomerStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version ?? 0,
    });
  }

  static toPersistence(customer: StoreCustomer): DbStoreCustomerRow {
    return {
      id: customer.getId(),
      tenant_id: customer.getTenantId(),
      global_auth_id: customer.getGlobalAuthId(),
      status: customer.getStatus(),
      created_at: customer.getCreatedAt().toISOString(),
      updated_at: customer.getUpdatedAt().toISOString(),
      version: customer.getVersion(),
    };
  }
}
