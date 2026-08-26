import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCartAttributeException extends DomainException {
  constructor(reason: string) {
    super(`Invalid cart attribute: ${reason}`);
  }
}
