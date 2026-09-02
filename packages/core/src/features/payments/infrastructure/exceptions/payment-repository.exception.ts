import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class PaymentRepositoryException extends InfrastructureException {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'PaymentRepositoryException';
  }
}
