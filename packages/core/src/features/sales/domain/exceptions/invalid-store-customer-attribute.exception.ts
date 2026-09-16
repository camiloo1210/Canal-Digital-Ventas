import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidStoreCustomerAttributeException extends DomainException {
  constructor(reason: string) {
    super(`Invalid store customer attribute: ${reason}`);
  }
}
