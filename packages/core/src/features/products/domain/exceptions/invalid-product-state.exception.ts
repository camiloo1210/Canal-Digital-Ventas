import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidProductStateException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProductStateException';
  }
}
