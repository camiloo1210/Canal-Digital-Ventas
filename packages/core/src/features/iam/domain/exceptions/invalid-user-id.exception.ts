import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidUserIdException extends DomainException {
  constructor(message = 'Invalid UUID format for UserId') {
    super(message);
    this.name = 'InvalidUserIdException';
  }
}
