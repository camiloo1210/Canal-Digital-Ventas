import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class BuyerCartRepositoryException extends InfrastructureException {
  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
    this.name = 'BuyerCartRepositoryException';
  }
}
