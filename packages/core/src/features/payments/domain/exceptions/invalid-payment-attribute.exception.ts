import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidPaymentAttributeException extends DomainException {
  constructor(reason: string) {
    super(`Invalid payment attribute: ${reason}`);
  }
}
