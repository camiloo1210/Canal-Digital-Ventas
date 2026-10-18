import { describe, it, expect, vi } from 'vitest';
import { ReconcileRefundUseCase } from '@/payments/application/use-cases/reconcile-refund.use-case';
import type {
  RefundReconciliationPort,
  PaymentEvidenceEgressPort,
} from '@/payments/application/ports/out/refund-reconciliation.port';
function fixture(): { repository: RefundReconciliationPort; egress: PaymentEvidenceEgressPort } {
  return {
    repository: {
      claim: vi.fn().mockResolvedValue({ operationId: 'operation', paymentId: 'payment' }),
      issueTicket: vi.fn().mockResolvedValue({
        ticketId: 'ticket',
        url: 'https://api.lemonsqueezy.com/v1/orders/123',
        environment: 'test',
      }),
      confirm: vi.fn().mockResolvedValue('CLOSED_BY_OBSERVED_COVERAGE'),
      recoverAbandoned: vi.fn().mockResolvedValue(0),
    },
    egress: { verify: vi.fn().mockResolvedValue('verification') },
  };
}
describe('Refund reconciliation orchestration', (): void => {
  it('applies GET evidence only after an independent egress receipt', async (): Promise<void> => {
    const { repository, egress } = fixture();
    expect(
      await new ReconcileRefundUseCase(repository, egress).execute('worker', 'SETTLEMENT'),
    ).toBe('CLOSED_BY_OBSERVED_COVERAGE');
    expect(repository.claim).toHaveBeenCalledWith('worker', 'SETTLEMENT');
    expect(repository.issueTicket).toHaveBeenCalledWith('payment', 'operation', 'worker');
    expect(repository.confirm).toHaveBeenCalledWith('operation', 'verification', 'worker');
  });
  it('never confirms when GET evidence recording fails', async (): Promise<void> => {
    const { repository, egress } = fixture();
    vi.mocked(egress.verify).mockRejectedValue(new Error('unavailable'));
    await expect(
      new ReconcileRefundUseCase(repository, egress).execute('worker', 'SETTLEMENT'),
    ).rejects.toThrow('unavailable');
    expect(repository.confirm).not.toHaveBeenCalled();
  });
  it('collects evidence for ambiguous operations without automatically closing them', async (): Promise<void> => {
    const { repository, egress } = fixture();
    expect(await new ReconcileRefundUseCase(repository, egress).execute('worker', 'EVIDENCE')).toBe(
      'EVIDENCE_RECORDED',
    );
    expect(repository.confirm).not.toHaveBeenCalled();
  });
  it('returns idle without GET traffic when no operation is due', async (): Promise<void> => {
    const { repository, egress } = fixture();
    vi.mocked(repository.claim).mockResolvedValue(null);
    expect(
      await new ReconcileRefundUseCase(repository, egress).execute('worker', 'SETTLEMENT'),
    ).toBe('IDLE');
    expect(egress.verify).not.toHaveBeenCalled();
  });
});
