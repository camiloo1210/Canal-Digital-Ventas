import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class UserRepositoryException extends InfrastructureException {
  constructor(message: string) {
    super(message);
    this.name = 'UserRepositoryException';
  }
}
