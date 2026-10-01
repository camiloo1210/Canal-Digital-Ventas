import { StoreCustomer } from '@/sales/domain/entities/store-customer.entity';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { GlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { Address } from '@/shared/domain/value-objects/adress.vo';

export interface ResolveStoreCustomerInput {
  tenantId: TenantId;
  globalAuthId: GlobalAuthId;
  name: string;
  email: string;
  phone: string;
  documentId: string;
  address: Address;
}

export interface StoreCustomerRepositoryPort {
  resolveOrCreate(input: ResolveStoreCustomerInput, tx: TransactionContext): Promise<StoreCustomer>;
}
