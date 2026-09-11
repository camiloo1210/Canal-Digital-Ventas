import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidUserStateException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserStateException';
  }
}
