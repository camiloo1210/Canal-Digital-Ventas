import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidAddressException extends DomainException {
  constructor(reason: string) {
    super(`Invalid address: ${reason}`);
  }
}
