import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class AuthenticationFailedException extends DomainException {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationFailedException';
  }
}
