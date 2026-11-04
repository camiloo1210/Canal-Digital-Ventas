import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class StaffAccountConfirmationRequiredException extends ApplicationException {
  constructor() {
    super('Email confirmation is enabled, so the generated staff account cannot sign in');
    this.name = 'StaffAccountConfirmationRequiredException';
  }
}
