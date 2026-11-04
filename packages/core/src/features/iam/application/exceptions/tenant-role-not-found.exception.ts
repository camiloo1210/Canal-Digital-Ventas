import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class TenantRoleNotFoundException extends ApplicationException {
  constructor() {
    super('Role not found');
    this.name = 'TenantRoleNotFoundException';
  }
}
