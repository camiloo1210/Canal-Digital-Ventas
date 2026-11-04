import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class TenantRoleNameTakenException extends ApplicationException {
  constructor() {
    super('A role with this name already exists');
    this.name = 'TenantRoleNameTakenException';
  }
}
