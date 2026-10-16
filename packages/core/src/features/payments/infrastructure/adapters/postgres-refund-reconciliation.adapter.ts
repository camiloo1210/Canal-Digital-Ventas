import type postgres from 'postgres';
import type {
  PaymentEgressTicket,
  RefundReconciliationClaim,
  RefundReconciliationMode,
  RefundReconciliationPort,
} from '@/payments/application/ports/out/refund-reconciliation.port';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

export class PostgresRefundReconciliationAdapter implements RefundReconciliationPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}
  public async claim(
    workerToken: string,
    mode: RefundReconciliationMode,
  ): Promise<RefundReconciliationClaim | null> {
    try {
      const rows = await this.sql<
        { operation_id: string; payment_id: string }[]
      >`SELECT * FROM sales.claim_refunds_for_reconciliation(${workerToken}::uuid,${mode})`;
      return rows[0] ? { operationId: rows[0].operation_id, paymentId: rows[0].payment_id } : null;
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Refund reconciliation claim failed.', error);
    }
  }
  public async issueTicket(
    paymentId: string,
    operationId: string | null,
    workerToken: string,
  ): Promise<PaymentEgressTicket> {
    try {
      const rows = await this.sql<
        { ticket_id: string; url: string; environment: string }[]
      >`SELECT * FROM sales.issue_egress_ticket(${paymentId}::uuid,${operationId}::uuid,${workerToken}::uuid)`;
      const row = rows[0];
      if (
        !row ||
        !/^https:\/\/api\.lemonsqueezy\.com\/v1\/orders\/[1-9]\d*$/.test(row.url) ||
        (row.environment !== 'test' && row.environment !== 'production')
      )
        throw new PaymentRepositoryException('Invalid evidence ticket.');
      return { ticketId: row.ticket_id, url: row.url, environment: row.environment };
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Evidence ticket issuance failed.', error);
    }
  }
  public async confirm(
    operationId: string,
    verificationId: string,
    workerToken: string,
  ): Promise<string> {
    try {
      const rows = await this.sql<
        { outcome: string }[]
      >`SELECT sales.confirm_refund_operation_settlement(${operationId}::uuid,${verificationId}::uuid,${workerToken}::uuid) AS outcome`;
      const outcome = rows[0]?.outcome;
      if (
        !outcome ||
        ![
          'CLOSED_BY_OBSERVED_COVERAGE',
          'OBSERVED_UNATTRIBUTED',
          'AMBIGUOUS_UNRESOLVED_EXPOSURE',
          'REQUEST_ACCEPTED_BY_GATEWAY',
        ].includes(outcome)
      )
        throw new PaymentRepositoryException('Invalid refund settlement receipt.');
      return outcome;
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Refund settlement confirmation failed.', error);
    }
  }
  public async recoverAbandoned(): Promise<number> {
    try {
      const rows = await this.sql<
        { count: number }[]
      >`SELECT sales.recover_abandoned_leases() AS count`;
      const count = rows[0]?.count;
      if (!Number.isSafeInteger(count) || count < 0)
        throw new PaymentRepositoryException('Invalid abandoned lease receipt.');
      return count;
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Refund lease recovery failed.', error);
    }
  }
}
