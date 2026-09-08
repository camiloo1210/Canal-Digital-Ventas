import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidRoleException extends DomainException {
  constructor(role: string) {
    super(`Invalid role: ${role}`);
    this.name = 'InvalidRoleException';
  }
}
