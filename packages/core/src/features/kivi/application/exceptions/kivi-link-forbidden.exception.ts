import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class KiviLinkForbiddenException extends ApplicationException {
  constructor() {
    super('Only the store owner can manage the Kivi connection.');
  }
}
