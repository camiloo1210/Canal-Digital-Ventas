import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class UserNotFoundException extends ApplicationException {
  constructor(userId: string) {
    super(`User with id ${userId} not found`);
    this.name = 'UserNotFoundException';
  }
}
