import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class TenantNotFoundException extends ApplicationException {
  constructor(message?: string) {
    super(message || 'Tenant not found');
  }
}
