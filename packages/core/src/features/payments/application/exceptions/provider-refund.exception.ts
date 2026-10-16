import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class ProviderRefundException extends InfrastructureException {
  public constructor(
    public readonly outcome: 'AMBIGUOUS' | 'REJECTED',
    public readonly httpStatus: number | null,
  ) {
    super('The refund request could not be confirmed.');
    this.name = 'ProviderRefundException';
  }
}
