import type {
  RefundReconciliationPort,
  PaymentEvidenceEgressPort,
  RefundReconciliationMode,
} from '@/payments/application/ports/out/refund-reconciliation.port';

export class ReconcileRefundUseCase {
  public constructor(
    private readonly repository: RefundReconciliationPort,
    private readonly egress: PaymentEvidenceEgressPort,
  ) {}
  public async execute(workerToken: string, mode: RefundReconciliationMode): Promise<string> {
    const claim = await this.repository.claim(workerToken, mode);
    if (claim === null) return 'IDLE';
    const ticket = await this.repository.issueTicket(
      claim.paymentId,
      claim.operationId,
      workerToken,
    );
    const verificationId = await this.egress.verify(ticket, workerToken);
    if (mode === 'EVIDENCE') return 'EVIDENCE_RECORDED';
    return this.repository.confirm(claim.operationId, verificationId, workerToken);
  }
}
