import type postgres from 'postgres';
import type {
  PaymentOrderRepairCandidate,
  PaymentOrderRepairReadPort,
} from '@/orders/application/ports/out/payment-order-repair-read.port';
import { OrderRepositoryException } from '@/orders/application/exceptions/order-repository.exception';

export class PostgresPaymentOrderRepairReadAdapter implements PaymentOrderRepairReadPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}
  public async findDue(limit: number): Promise<PaymentOrderRepairCandidate[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new OrderRepositoryException('Invalid repair batch size.');
    try {
      const rows = await this.sql<
        { payment_id: string; order_id: string; tenant_id: string; operation: string }[]
      >`SELECT * FROM sales.payment_order_repair_candidates ORDER BY payment_id LIMIT ${limit}`;
      return rows.map((row): PaymentOrderRepairCandidate => {
        if (row.operation !== 'PAID' && row.operation !== 'EXPIRE' && row.operation !== 'REFUND')
          throw new OrderRepositoryException('Invalid repair operation.');
        return {
          paymentId: row.payment_id,
          orderId: row.order_id,
          tenantId: row.tenant_id,
          operation: row.operation,
        };
      });
    } catch (error: unknown) {
      throw new OrderRepositoryException('Payment order repair discovery failed.', error);
    }
  }
}
