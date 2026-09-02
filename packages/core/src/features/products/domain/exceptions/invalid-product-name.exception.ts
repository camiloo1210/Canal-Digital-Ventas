import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidProductNameException extends DomainException {
  constructor(reason: string) {
    super(`Invalid product name: ${reason}`);
  }
}
