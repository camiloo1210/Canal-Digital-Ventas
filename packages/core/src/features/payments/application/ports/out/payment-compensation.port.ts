export interface PaymentCompensationCandidate {
  obligationId: string;
  paymentId: string;
  tenantId: string;
  remainingCents: number;
}
export interface PaymentCompensationPort {
  findDue(): Promise<PaymentCompensationCandidate | null>;
  create(candidate: PaymentCompensationCandidate): Promise<string>;
}
