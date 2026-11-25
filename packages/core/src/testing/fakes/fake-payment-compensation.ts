import type {
  PaymentCompensationCandidate,
  PaymentCompensationPort,
} from '@/payments/application/ports/out/payment-compensation.port';

/** Holds due candidates; `create` consumes the candidate (a created obligation is no longer due). */
export class FakePaymentCompensation implements PaymentCompensationPort {
  public readonly created: PaymentCompensationCandidate[] = [];
  public findDueCalls = 0;

  public constructor(private readonly due: PaymentCompensationCandidate[] = []) {}

  async findDue(): Promise<PaymentCompensationCandidate | null> {
    this.findDueCalls++;
    return this.due[0] ?? null;
  }

  async create(candidate: PaymentCompensationCandidate): Promise<string> {
    this.created.push(candidate);
    const index = this.due.findIndex(
      (item): boolean => item.obligationId === candidate.obligationId,
    );
    if (index >= 0) this.due.splice(index, 1);
    return `compensation-${this.created.length}`;
  }
}
