import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class ProductNotFoundException extends ApplicationException {
  constructor(id: string) {
    super(`Product with ID '${id}' was not found.`);
    this.name = 'ProductNotFoundException';
  }
}
