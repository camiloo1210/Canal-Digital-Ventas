import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidPersonNameException extends DomainException {
  constructor(message = 'Invalid person name format') {
    super(message);
    this.name = 'InvalidPersonNameException';
  }
}
