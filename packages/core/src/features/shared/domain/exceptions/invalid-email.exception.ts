import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidEmailException extends DomainException {
  constructor() {
    super('Invalid email address format.');
  }
}
