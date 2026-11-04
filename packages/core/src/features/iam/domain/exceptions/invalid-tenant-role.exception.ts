import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidTenantRoleException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTenantRoleException';
  }
}
