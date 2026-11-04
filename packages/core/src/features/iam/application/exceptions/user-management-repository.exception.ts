import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class UserManagementRepositoryException extends InfrastructureException {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'UserManagementRepositoryException';
  }
}
