import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCredentialsException extends DomainException {
  constructor(message = 'Invalid email or password') {
    super(message);
    this.name = 'InvalidCredentialsException';
  }
}
