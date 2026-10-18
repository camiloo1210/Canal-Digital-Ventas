import { StoreCustomer } from '@/sales/domain/entities/store-customer.entity';
import { StoreCustomerId } from '@/sales/domain/types/customer-id.type';
import { GlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';

export interface StoreCustomerRepositoryPort {
  save(customer: StoreCustomer): Promise<void>;
  findById(id: StoreCustomerId, tenantId: TenantId): Promise<StoreCustomer | null>;
  findByTenantAndGlobalAuthId(
    tenantId: TenantId,
    globalAuthId: GlobalAuthId,
  ): Promise<StoreCustomer | null>;
}
