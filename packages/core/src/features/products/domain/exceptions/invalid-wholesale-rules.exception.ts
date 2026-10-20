import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';

export class InvalidWholesaleRulesException extends InvalidProductAttributeException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWholesaleRulesException';
  }
}
