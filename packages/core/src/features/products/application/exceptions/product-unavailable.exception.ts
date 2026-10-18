import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class ProductUnavailableException extends ApplicationException {
  constructor(message = 'Product is unavailable.') {
    super(message);
    this.name = 'ProductUnavailableException';
  }
}
