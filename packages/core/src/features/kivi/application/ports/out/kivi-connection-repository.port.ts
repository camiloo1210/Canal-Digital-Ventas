import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';

export interface KiviConnectionRepositoryPort {
  /** True only for an active OWNER membership of the store. */
  isStoreOwner(userId: string, tenantId: string, tx: TransactionContext): Promise<boolean>;
  /** Display name of the store, or null when the store does not exist. */
  findStoreName(tenantId: string, tx: TransactionContext): Promise<string | null>;
  findByTenant(tenantId: string, tx: TransactionContext): Promise<KiviConnection | null>;
  save(connection: KiviConnection, tx: TransactionContext): Promise<void>;
}
