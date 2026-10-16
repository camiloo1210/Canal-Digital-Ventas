import type postgres from 'postgres';
import type {
  PaymentInboxProcessingPort,
  PaymentSettlementResult,
} from '@/payments/application/ports/out/payment-inbox-processing.port';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

export class PostgresPaymentInboxProcessingAdapter implements PaymentInboxProcessingPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async claim(workerToken: string): Promise<string | null> {
    try {
      const rows = await this.sql<
        { event_id: string }[]
      >`SELECT event_id FROM sales.claim_inbox_events(${workerToken}::uuid,'order_created')`;
      return rows[0]?.event_id ?? null;
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Payment inbox claim failed.', error);
    }
  }

  public async settle(eventId: string, workerToken: string): Promise<PaymentSettlementResult> {
    try {
      const rows = await this.sql<
        { outcome: string }[]
      >`SELECT sales.sync_payment_success_transition(${eventId}::uuid,${workerToken}::uuid) AS outcome`;
      const outcome = rows[0]?.outcome;
      if (
        outcome !== 'COMPLETED' &&
        outcome !== 'LATE_PAYMENT' &&
        outcome !== 'ALREADY_PROCESSED'
      ) {
        throw new PaymentRepositoryException('Invalid settlement receipt.');
      }
      return outcome;
    } catch (error: unknown) {
      if (error instanceof PaymentRepositoryException) throw error;
      throw new PaymentRepositoryException('Payment settlement failed.', error);
    }
  }

  public async fail(eventId: string, workerToken: string): Promise<boolean> {
    try {
      const rows = await this.sql<
        { recorded: boolean }[]
      >`SELECT sales.mark_inbox_event_failed(${eventId}::uuid,${workerToken}::uuid) AS recorded`;
      if (typeof rows[0]?.recorded !== 'boolean')
        throw new PaymentRepositoryException('Invalid retry receipt.');
      return rows[0].recorded;
    } catch (error: unknown) {
      if (error instanceof PaymentRepositoryException) throw error;
      throw new PaymentRepositoryException('Payment inbox retry failed.', error);
    }
  }
}
