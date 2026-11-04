import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class MemberNotActiveException extends ApplicationException {
  constructor() {
    super('Only active members can be assigned a role');
    this.name = 'MemberNotActiveException';
  }
}
