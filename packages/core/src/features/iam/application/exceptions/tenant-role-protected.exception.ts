import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class TenantRoleProtectedException extends ApplicationException {
  constructor() {
    super('A default role can be edited but not deleted');
    this.name = 'TenantRoleProtectedException';
  }
}
