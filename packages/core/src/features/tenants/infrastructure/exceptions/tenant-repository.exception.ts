import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class TenantRepositoryException extends InfrastructureException {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'TenantRepositoryException';
  }
}
