import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class TenantContextReadException extends InfrastructureException {
  constructor(cause: unknown) {
    super('Unable to read the active tenant context', cause);
    this.name = 'TenantContextReadException';
  }
}
