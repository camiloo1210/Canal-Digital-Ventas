import { OrderTenantRepositoryPort } from '@/orders/application/ports/out/order-tenant-repository.port';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { TenantId, createTenantId } from '@/shared/domain/types/tenant-id.type';
import postgres from 'postgres';

export class PostgresOrderTenantRepository implements OrderTenantRepositoryPort {
  async findActiveBySlug(
    tenantSlug: string,
    tx: TransactionContext,
  ): Promise<{ id: TenantId } | null> {
    const result = await tx.executeNative(
      async (sql: postgres.TransactionSql<Record<string, unknown>>) => {
        return sql<{ id: string }[]>`
          SELECT id
          FROM core.tenants
          WHERE slug = ${tenantSlug}
            AND status = 'ACTIVE'
        `;
      },
    );

    if (result.length === 0) {
      return null;
    }

    return { id: createTenantId(result[0].id) };
  }
}
