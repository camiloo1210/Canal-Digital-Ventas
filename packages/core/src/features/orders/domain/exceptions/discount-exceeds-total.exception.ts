import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class DiscountExceedsTotalException extends DomainException {
  constructor() {
    super('Discount cannot exceed the sum of subtotal, tax and shipping.');
  }
}
