import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class AdminCatalogReadException extends InfrastructureException {
  constructor(cause: unknown) {
    super('Unable to read the admin catalog', cause);
    this.name = 'AdminCatalogReadException';
  }
}
