import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class ProtectedMemberException extends ApplicationException {
  constructor() {
    super('Store owners cannot be reassigned');
    this.name = 'ProtectedMemberException';
  }
}
