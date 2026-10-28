import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class KiviConnectionNotFoundException extends ApplicationException {
  constructor() {
    super('The store has no Kivi connection.');
  }
}
