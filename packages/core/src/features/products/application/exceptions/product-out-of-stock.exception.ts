import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class ProductOutOfStockException extends ApplicationException {
  constructor(message = 'Product is out of stock.') {
    super(message);
    this.name = 'ProductOutOfStockException';
  }
}
