import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class TenantNotAvailableException extends ApplicationException {
  constructor() {
    super('No existe un tenant comercial activo y disponible para este contexto.');
    this.name = 'TenantNotAvailableException';
  }
}
