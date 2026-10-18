import type {
  PaymentInboxProcessingPort,
  PaymentSettlementResult,
} from '@/payments/application/ports/out/payment-inbox-processing.port';

export type ProcessPaymentInboxResult =
  PaymentSettlementResult | 'IDLE' | 'RETRY_SCHEDULED' | 'LEASE_LOST';

export class ProcessPaymentInboxUseCase {
  public constructor(private readonly inbox: PaymentInboxProcessingPort) {}

  public async execute(workerToken: string): Promise<ProcessPaymentInboxResult> {
    const eventId = await this.inbox.claim(workerToken);
    if (eventId === null) return 'IDLE';
    try {
      return await this.inbox.settle(eventId, workerToken);
    } catch {
      // A failed fenced update is never retried as an unfenced mutation.
      return (await this.inbox.fail(eventId, workerToken)) ? 'RETRY_SCHEDULED' : 'LEASE_LOST';
    }
  }
}
