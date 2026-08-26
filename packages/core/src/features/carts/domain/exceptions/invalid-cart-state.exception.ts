import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCartStateException extends DomainException {
  constructor(reason: string) {
    super(`Invalid cart state: ${reason}`);
  }
}
