import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class PaymentRepositoryException extends InfrastructureException {
  constructor(message: string) {
    super(message);
  }
}
