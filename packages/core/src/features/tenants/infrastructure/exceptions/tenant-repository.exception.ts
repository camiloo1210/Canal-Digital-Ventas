import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class TenantRepositoryException extends InfrastructureException {
  constructor(message: string) {
    super(message);
  }
}
