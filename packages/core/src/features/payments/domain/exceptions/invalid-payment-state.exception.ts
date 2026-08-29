import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidPaymentStateException extends DomainException {
  constructor(reason: string) {
    super(`Invalid payment state transition: ${reason}`);
  }
}
