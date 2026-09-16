import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidPermissionException extends DomainException {
  constructor(permission: string) {
    super(`Invalid permission: ${permission}`);
    this.name = 'InvalidPermissionException';
  }
}
