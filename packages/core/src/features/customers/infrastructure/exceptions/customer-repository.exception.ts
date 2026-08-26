import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class CustomerRepositoryException extends InfrastructureException {
  constructor(message: string) {
    super(message);
  }
}
