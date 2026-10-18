import type postgres from 'postgres';
import type {
  RefundDispatchClaim,
  RefundDispatchPort,
} from '@/payments/application/ports/out/refund-dispatch.port';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

export class PostgresRefundDispatchAdapter implements RefundDispatchPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}
  public async claim(workerToken: string): Promise<RefundDispatchClaim | null> {
    try {
      const rows = await this.sql<
        {
          operation_id: string;
          payment_id: string;
          provider_order_id: string;
          environment: string;
          amount_cents: number;
          store_id: string;
          currency: string;
        }[]
      >`SELECT * FROM sales.claim_and_mark_dispatching(${workerToken}::uuid)`;
      const row = rows[0];
      if (!row) return null;
      if (
        (row.environment !== 'test' && row.environment !== 'production') ||
        !Number.isSafeInteger(row.amount_cents) ||
        row.amount_cents <= 0 ||
        !/^[1-9]\d{0,19}$/.test(row.provider_order_id) ||
        !/^[1-9]\d{0,19}$/.test(row.store_id) ||
        !/^[A-Z]{3}$/.test(row.currency)
      )
        throw new PaymentRepositoryException('Invalid refund dispatch receipt.');
      return {
        operationId: row.operation_id,
        paymentId: row.payment_id,
        providerOrderId: row.provider_order_id,
        environment: row.environment,
        amountCents: row.amount_cents,
        storeId: row.store_id,
        currency: row.currency,
      };
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Refund dispatch claim failed.', error);
    }
  }
  public async markSubmitted(
    operationId: string,
    workerToken: string,
    providerOrderId: string,
  ): Promise<void> {
    try {
      await this
        .sql`SELECT sales.mark_refund_submitted(${operationId}::uuid,${workerToken}::uuid,${providerOrderId})`;
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Refund acknowledgement failed.', error);
    }
  }
  public async markAmbiguous(operationId: string, workerToken: string): Promise<void> {
    try {
      await this
        .sql`SELECT sales.mark_refund_ambiguous_on_timeout(${operationId}::uuid,${workerToken}::uuid)`;
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Refund ambiguity acknowledgement failed.', error);
    }
  }
  public async markRejected(
    operationId: string,
    workerToken: string,
    httpStatus: number,
  ): Promise<void> {
    try {
      await this
        .sql`SELECT sales.mark_refund_failed_from_gateway(${operationId}::uuid,${workerToken}::uuid,${httpStatus})`;
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Refund rejection acknowledgement failed.', error);
    }
  }
}
