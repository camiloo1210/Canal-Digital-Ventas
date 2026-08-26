import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class CartRepositoryException extends InfrastructureException {
  constructor(message: string) {
    super(message);
  }
}
