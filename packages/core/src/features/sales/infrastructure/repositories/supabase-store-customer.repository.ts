import { SupabaseClient } from '@supabase/supabase-js';
import { StoreCustomerRepositoryPort } from '@/sales/application/ports/out/customer-repository.port';
import { StoreCustomer } from '@/sales/domain/entities/store-customer.entity';
import { SupabaseStoreCustomerMapper } from '@/sales/infrastructure/mappers/supabase-customer.mapper';
import { DbStoreCustomerRow } from '@/sales/infrastructure/types/supabase-customer.types';
import { StoreCustomerId } from '@/sales/domain/types/customer-id.type';
import { GlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { StoreCustomerRepositoryException } from '@/sales/application/exceptions/store-customer-repository.exception';

export class SupabaseStoreCustomerRepository implements StoreCustomerRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(customer: StoreCustomer): Promise<void> {
    const customerRow = SupabaseStoreCustomerMapper.toPersistence(customer);

    const { error } = await this.supabase.rpc('upsert_store_customer_transactional', {
      customer_data: customerRow,
    });

    if (error) {
      if (error.code === 'P0001') {
        throw new StoreCustomerRepositoryException(
          'Optimistic locking failure: The store customer was updated by another transaction.',
          error,
        );
      }
      throw new StoreCustomerRepositoryException(
        `Failed to save store customer: ${error.message}`,
        error,
      );
    }
  }

  async findById(id: StoreCustomerId, tenantId: TenantId): Promise<StoreCustomer | null> {
    const { data, error } = await this.supabase
      .schema('sales')
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        throw new StoreCustomerRepositoryException(
          `Database error searching store customer: ${error.message}`,
        );
      }
      return null;
    }

    return SupabaseStoreCustomerMapper.toDomain(data as DbStoreCustomerRow);
  }

  async findByTenantAndGlobalAuthId(
    tenantId: TenantId,
    globalAuthId: GlobalAuthId,
  ): Promise<StoreCustomer | null> {
    const { data, error } = await this.supabase
      .schema('sales')
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('global_auth_id', globalAuthId)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        throw new StoreCustomerRepositoryException(
          `Database error searching store customer: ${error.message}`,
        );
      }
      return null;
    }

    return SupabaseStoreCustomerMapper.toDomain(data as DbStoreCustomerRow);
  }
}
