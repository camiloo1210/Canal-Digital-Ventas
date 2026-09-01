import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class CategoryRepositoryException extends InfrastructureException {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'CategoryRepositoryException';
  }
}
