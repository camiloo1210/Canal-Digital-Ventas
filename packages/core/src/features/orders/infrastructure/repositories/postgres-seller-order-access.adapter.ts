import type postgres from 'postgres';
import type { SellerOrderAccessPort } from '@/orders/application/ports/out/seller-order-access.port';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { OrderRepositoryException } from '@/orders/application/exceptions/order-repository.exception';

export class PostgresSellerOrderAccessAdapter implements SellerOrderAccessPort {
  public async assertCanManage(
    userId: string,
    tenantId: string,
    orderId: string,
    tx: TransactionContext,
  ): Promise<void> {
    try {
      const allowed = await tx.executeNative<
        postgres.TransactionSql<Record<string, unknown>>,
        boolean
      >(async (sql): Promise<boolean> => {
        const rows = await sql`SELECT id FROM core.tenant_memberships
            WHERE user_id=${userId}::uuid AND tenant_id=${tenantId}::uuid
            AND status='active' AND role IN ('OWNER','ADMIN')
            AND EXISTS(SELECT 1 FROM sales.orders o WHERE o.id=${orderId}::uuid AND o.tenant_id=${tenantId}::uuid)
            FOR SHARE`;
        return rows.length === 1;
      });
      if (!allowed) throw new OrderNotFoundException();
    } catch (error: unknown) {
      if (error instanceof OrderNotFoundException) throw error;
      throw new OrderRepositoryException('Seller authorization failed.', error);
    }
  }
}
