import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class OptimisticConcurrencyException extends ApplicationException {
  constructor(entityName: string, id: string) {
    super(
      `Optimistic concurrency violation: ${entityName} with id ${id} was modified by another transaction.`,
    );
    this.name = 'OptimisticConcurrencyException';
  }
}
