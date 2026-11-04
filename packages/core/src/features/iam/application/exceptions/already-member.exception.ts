import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class AlreadyMemberException extends ApplicationException {
  constructor() {
    super('The user already belongs to this store');
    this.name = 'AlreadyMemberException';
  }
}
