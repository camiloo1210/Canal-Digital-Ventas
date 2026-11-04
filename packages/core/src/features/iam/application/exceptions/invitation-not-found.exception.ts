import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class InvitationNotFoundException extends ApplicationException {
  constructor() {
    super('Invitation not found');
    this.name = 'InvitationNotFoundException';
  }
}
