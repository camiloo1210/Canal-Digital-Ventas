import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class UserManagementForbiddenException extends ApplicationException {
  constructor() {
    super('Only the store owner can manage users');
    this.name = 'UserManagementForbiddenException';
  }
}
