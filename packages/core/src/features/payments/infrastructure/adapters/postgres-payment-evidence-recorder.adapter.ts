import type postgres from 'postgres';
import type {
  PaymentEvidenceRecorderPort,
  RecordPaymentEvidence,
} from '@/payments/application/ports/out/payment-evidence-recorder.port';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

export class PostgresPaymentEvidenceRecorderAdapter implements PaymentEvidenceRecorderPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}
  public async record(input: RecordPaymentEvidence): Promise<string> {
    try {
      const rows = await this.sql<
        { id: string }[]
      >`SELECT sales.record_api_verification(${input.ticketId}::uuid,${input.workerToken}::uuid,${input.url},${input.httpStatus},${Buffer.from(input.payload)}::bytea,${input.sha256},${this.sql.json({ ...input.headers })}::jsonb) AS id`;
      if (typeof rows[0]?.id !== 'string')
        throw new PaymentRepositoryException('Invalid evidence receipt.');
      return rows[0].id;
    } catch (error: unknown) {
      throw new PaymentRepositoryException('Evidence recording failed.', error);
    }
  }
}
