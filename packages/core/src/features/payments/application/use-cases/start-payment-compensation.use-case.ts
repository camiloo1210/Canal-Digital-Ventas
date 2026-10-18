import type { PaymentCompensationPort } from '@/payments/application/ports/out/payment-compensation.port';

export class StartPaymentCompensationUseCase {
  public constructor(private readonly compensation: PaymentCompensationPort) {}
  public async execute(): Promise<'IDLE' | 'CREATED'> {
    const candidate = await this.compensation.findDue();
    if (candidate === null) return 'IDLE';
    await this.compensation.create(candidate);
    return 'CREATED';
  }
}
