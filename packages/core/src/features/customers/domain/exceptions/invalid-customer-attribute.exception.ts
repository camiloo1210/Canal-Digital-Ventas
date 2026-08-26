import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCustomerAttributeException extends DomainException {
  constructor(reason: string) {
    super(`Invalid customer attribute: ${reason}`);
  }
}
