import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class ProviderCheckoutException extends InfrastructureException {
  public constructor(
    public readonly outcome: 'AMBIGUOUS' | 'REJECTED',
    public readonly reasonCode: string,
    originalError?: unknown,
  ) {
    super('Unable to establish a usable provider checkout.', originalError);
    this.name = 'ProviderCheckoutException';
  }
}
