import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidRoleOperationException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRoleOperationException';
  }
}
