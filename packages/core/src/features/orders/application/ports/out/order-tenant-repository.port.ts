import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { TenantId } from '@/shared/domain/types/tenant-id.type';

export interface OrderTenantRepositoryPort {
  findActiveBySlug(tenantSlug: string, tx: TransactionContext): Promise<{ id: TenantId } | null>;
}
