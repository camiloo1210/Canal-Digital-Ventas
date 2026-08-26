import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCustomerStateException extends DomainException {
  constructor(reason: string) {
    super(`Invalid customer state transition: ${reason}`);
  }
}
