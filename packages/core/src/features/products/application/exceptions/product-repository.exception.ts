import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class ProductRepositoryException extends ApplicationException {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'ProductRepositoryException';
  }
}
