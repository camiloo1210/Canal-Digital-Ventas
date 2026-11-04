import { ApplicationException } from '@/shared/application/exceptions/application.exception';

/** The account belongs to the person (Google or their own email); a business cannot alter or deactivate it. */
export class PersonalAccountProtectedException extends ApplicationException {
  constructor() {
    super('Personal accounts cannot be altered by the business');
    this.name = 'PersonalAccountProtectedException';
  }
}
