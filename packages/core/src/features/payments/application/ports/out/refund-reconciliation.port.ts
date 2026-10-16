export type RefundReconciliationMode = 'SETTLEMENT' | 'EVIDENCE';
export interface RefundReconciliationClaim {
  operationId: string;
  paymentId: string;
}
export interface PaymentEgressTicket {
  ticketId: string;
  url: string;
  environment: 'test' | 'production';
}
export interface RefundReconciliationPort {
  claim(
    workerToken: string,
    mode: RefundReconciliationMode,
  ): Promise<RefundReconciliationClaim | null>;
  issueTicket(
    paymentId: string,
    operationId: string | null,
    workerToken: string,
  ): Promise<PaymentEgressTicket>;
  confirm(operationId: string, verificationId: string, workerToken: string): Promise<string>;
  recoverAbandoned(): Promise<number>;
}
/** Runs in a separate process with the GET API key and evidence-only DB role. */
export interface PaymentEvidenceEgressPort {
  verify(ticket: PaymentEgressTicket, workerToken: string): Promise<string>;
}
