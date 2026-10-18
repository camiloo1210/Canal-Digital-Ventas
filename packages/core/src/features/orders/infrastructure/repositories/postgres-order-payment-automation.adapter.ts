import type postgres from 'postgres';
import type {
  OrderPaymentAutomationPort,
  OrderAutomationPayment,
} from '@/orders/application/ports/out/order-payment-automation.port';
import type { OrderId } from '@/orders/domain/types/order-id.type';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { OrderRepositoryException } from '@/orders/application/exceptions/order-repository.exception';

export class PostgresOrderPaymentAutomationAdapter implements OrderPaymentAutomationPort {
  public async read(
    orderId: OrderId,
    tenantId: TenantId,
    tx: TransactionContext,
  ): Promise<OrderAutomationPayment | null> {
    try {
      return await tx.executeNative<
        postgres.TransactionSql<Record<string, unknown>>,
        OrderAutomationPayment | null
      >(async (sql): Promise<OrderAutomationPayment | null> => {
        const rows = await sql<
          {
            id: string;
            tenant_id: string;
            status: string;
            amount_cents: number;
            gateway_transaction_id: string | null;
            environment: string;
            excluded: boolean;
          }[]
        >`
          SELECT p.id,p.tenant_id,p.status,p.amount_cents,p.gateway_transaction_id,p.environment,
            EXISTS(SELECT 1 FROM sales.order_automation_exclusions x WHERE x.order_id=p.order_id) AS excluded
          FROM sales.payments p WHERE p.order_id=${orderId}::uuid AND p.tenant_id=${tenantId}::uuid AND p.status<>'failed'`;
        if (rows.length > 1)
          throw new OrderRepositoryException('Conflicting automation payment records.');
        const row = rows[0];
        return row
          ? {
              paymentId: row.id,
              tenantId: row.tenant_id,
              status: row.status,
              amountCents: row.amount_cents,
              providerOrderId: row.gateway_transaction_id,
              environment: row.environment,
              excluded: row.excluded,
            }
          : null;
      });
    } catch (error: unknown) {
      throw new OrderRepositoryException('Order automation payment read failed.', error);
    }
  }

  public async reserveExpiryCancellation(
    orderId: OrderId,
    paymentId: string,
    tenantId: TenantId,
    tx: TransactionContext,
  ): Promise<boolean> {
    try {
      return await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, boolean>(
        async (sql): Promise<boolean> => {
          const rows =
            await sql`INSERT INTO sales.order_expiry_cancellations(order_id,payment_id,tenant_id,reason)
          VALUES(${orderId}::uuid,${paymentId}::uuid,${tenantId}::uuid,'PAYMENT_EXPIRED') ON CONFLICT DO NOTHING RETURNING order_id`;
          return rows.length === 1;
        },
      );
    } catch (error: unknown) {
      throw new OrderRepositoryException('Expiry cancellation reservation failed.', error);
    }
  }
}
