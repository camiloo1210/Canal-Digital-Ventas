import { Currency } from '@/shared/domain/enums/currency.enum';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

/** Resolves the authoritative denomination of a tenant's product prices. */
export interface ProductCurrencyRepositoryPort {
  getCurrency(tenantId: TenantId, tx: TransactionContext): Promise<Currency>;
}
