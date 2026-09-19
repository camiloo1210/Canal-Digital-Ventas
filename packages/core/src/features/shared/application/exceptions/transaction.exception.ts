import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class TransactionException extends InfrastructureException {
  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
    this.name = 'TransactionException';
  }
}
