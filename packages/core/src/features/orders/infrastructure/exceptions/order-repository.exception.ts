import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class OrderRepositoryException extends InfrastructureException {
  constructor(message: string) {
    super(message);
  }
}
