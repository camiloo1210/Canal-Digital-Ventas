export type PaymentSettlementResult = 'COMPLETED' | 'LATE_PAYMENT' | 'ALREADY_PROCESSED';

export interface PaymentInboxProcessingPort {
  claim(workerToken: string): Promise<string | null>;
  settle(eventId: string, workerToken: string): Promise<PaymentSettlementResult>;
  fail(eventId: string, workerToken: string): Promise<boolean>;
}
