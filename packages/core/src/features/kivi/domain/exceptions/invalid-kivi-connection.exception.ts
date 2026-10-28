import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidKiviConnectionException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidKiviConnectionException';
  }
}
