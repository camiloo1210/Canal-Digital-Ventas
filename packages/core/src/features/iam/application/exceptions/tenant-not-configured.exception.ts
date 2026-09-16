import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class TenantNotConfiguredException extends ApplicationException {
  constructor(message: string = 'User does not have a tenant configured.') {
    super(message);
    this.name = 'TenantNotConfiguredException';
  }
}
