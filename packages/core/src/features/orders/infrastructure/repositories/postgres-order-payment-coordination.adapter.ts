import type postgres from 'postgres';
import type {
  OrderPaymentCoordinationPort,
  OrderPaymentSnapshot,
} from '@/orders/application/ports/out/order-payment-coordination.port';
import type { OrderId } from '@/orders/domain/types/order-id.type';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { OrderRepositoryException } from '@/orders/application/exceptions/order-repository.exception';

export class PostgresOrderPaymentCoordinationAdapter implements OrderPaymentCoordinationPort {
  public async lockAndReadPayment(
    orderId: OrderId,
    tx: TransactionContext,
  ): Promise<OrderPaymentSnapshot | null> {
    try {
      return await tx.executeNative<
        postgres.TransactionSql<Record<string, unknown>>,
        OrderPaymentSnapshot | null
      >(async (sql): Promise<OrderPaymentSnapshot | null> => {
        await sql`SET LOCAL lock_timeout='5s'`;
        await sql`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('canaldigital:order:' || ${orderId}::text,0))`;
        const isolation = await sql<
          { level: string }[]
        >`SELECT current_setting('transaction_isolation') AS level`;
        if (isolation[0]?.level !== 'read committed')
          throw new OrderRepositoryException('Order coordination requires READ COMMITTED.');
        await sql`SELECT id FROM sales.orders WHERE id=${orderId}::uuid FOR UPDATE`;
        const rows = await sql<
          { id: string; status: string }[]
        >`SELECT id,status FROM sales.payments
          WHERE order_id=${orderId}::uuid AND status<>'failed'`;
        if (rows.length > 1)
          throw new OrderRepositoryException('Conflicting payments require reconciliation.');
        return rows[0] ? { paymentId: rows[0].id, status: rows[0].status } : null;
      });
    } catch (error: unknown) {
      if (error instanceof OrderRepositoryException) throw error;
      throw new OrderRepositoryException('Order payment coordination failed.', error);
    }
  }
}
