import { DomainException } from '@/shared/domain/exceptions/domain.exception';

/** Never includes the rejected password in its message. */
export class InvalidManagedPasswordException extends DomainException {
  constructor() {
    super('The password does not meet the minimum requirements');
    this.name = 'InvalidManagedPasswordException';
  }
}
