import type postgres from 'postgres';
import type {
  PaymentCompensationPort,
  PaymentCompensationCandidate,
} from '@/payments/application/ports/out/payment-compensation.port';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

export class PostgresPaymentCompensationAdapter implements PaymentCompensationPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}
  public async findDue(): Promise<PaymentCompensationCandidate | null> {
    try {
      const rows = await this.sql<
        { obligation_id: string; payment_id: string; tenant_id: string; remaining_cents: number }[]
      >`SELECT * FROM sales.payment_compensation_candidates ORDER BY obligation_id LIMIT 1`;
      const row = rows[0];
      return row
        ? {
            obligationId: row.obligation_id,
            paymentId: row.payment_id,
            tenantId: row.tenant_id,
            remainingCents: row.remaining_cents,
          }
        : null;
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Compensation discovery failed.', error);
    }
  }
  public async create(candidate: PaymentCompensationCandidate): Promise<string> {
    try {
      const rows = await this.sql<
        { id: string }[]
      >`SELECT sales.create_refund_operation(${candidate.paymentId}::uuid,${candidate.tenantId}::uuid,${candidate.remainingCents},${`compensation:${candidate.obligationId}`},'LATE_PAYMENT_COMPENSATION',NULL,${candidate.obligationId}::uuid) AS id`;
      if (typeof rows[0]?.id !== 'string')
        throw new PaymentRepositoryException('Invalid compensation receipt.');
      return rows[0].id;
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Compensation creation failed.', error);
    }
  }
}
