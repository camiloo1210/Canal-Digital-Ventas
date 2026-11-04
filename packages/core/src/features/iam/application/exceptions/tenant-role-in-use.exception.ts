import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class TenantRoleInUseException extends ApplicationException {
  constructor() {
    super('The role still has members assigned');
    this.name = 'TenantRoleInUseException';
  }
}
