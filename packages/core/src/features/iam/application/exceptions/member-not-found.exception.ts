import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class MemberNotFoundException extends ApplicationException {
  constructor() {
    super('Member not found');
    this.name = 'MemberNotFoundException';
  }
}
