import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class CustomerRepositoryException extends InfrastructureException {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
  }
}
