import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class OrderRepositoryException extends InfrastructureException {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'OrderRepositoryException';
  }
}
