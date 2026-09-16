import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class UserRepositoryException extends ApplicationException {
  constructor(message: string) {
    super(message);
    this.name = 'UserRepositoryException';
  }
}
