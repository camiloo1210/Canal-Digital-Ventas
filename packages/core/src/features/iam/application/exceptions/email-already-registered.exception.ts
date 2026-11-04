import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class EmailAlreadyRegisteredException extends ApplicationException {
  constructor() {
    super('The email is already registered');
    this.name = 'EmailAlreadyRegisteredException';
  }
}
