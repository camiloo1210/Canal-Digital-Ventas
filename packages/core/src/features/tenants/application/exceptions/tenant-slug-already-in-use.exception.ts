import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class TenantSlugAlreadyInUseException extends ApplicationException {
  constructor(message?: string) {
    super(message || 'Tenant slug is already in use');
  }
}
