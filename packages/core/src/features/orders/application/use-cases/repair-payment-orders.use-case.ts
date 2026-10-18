import type { PaymentOrderRepairReadPort } from '@/orders/application/ports/out/payment-order-repair-read.port';
import type { MarkOrderPaidUseCase } from '@/orders/application/use-cases/mark-order-paid.use-case';
import type { CancelExpiredOrderUseCase } from '@/orders/application/use-cases/cancel-expired-order.use-case';
import type { ApplyObservedRefundToOrderUseCase } from '@/orders/application/use-cases/apply-observed-refund-to-order.use-case';

export class RepairPaymentOrdersUseCase {
  public constructor(
    private readonly candidates: PaymentOrderRepairReadPort,
    private readonly paid: MarkOrderPaidUseCase,
    private readonly expired: CancelExpiredOrderUseCase,
    private readonly refunded: ApplyObservedRefundToOrderUseCase,
  ) {}
  public async execute(): Promise<{ applied: number; reviewRequired: number }> {
    const candidates = await this.candidates.findDue(100);
    let applied = 0;
    let reviewRequired = 0;
    for (const candidate of candidates) {
      // Each existing use case owns its own transaction and re-reads authoritative state after locking.
      const result = await (
        candidate.operation === 'PAID'
          ? this.paid
          : candidate.operation === 'EXPIRE'
            ? this.expired
            : this.refunded
      ).execute(candidate);
      if (result === 'APPLIED') applied++;
      else if (result === 'MISMATCH' || result === 'EXCLUDED') reviewRequired++;
    }
    return { applied, reviewRequired };
  }
}
