import { ApplicationException } from '@/shared/application/exceptions/application.exception';

/**
 * A business account (created through an invitation link without Google and without the person's
 * own email) belongs to exactly one company and can never be linked to, or create, another one.
 */
export class BusinessAccountBoundException extends ApplicationException {
  constructor() {
    super('This business account can only belong to the company that manages it');
    this.name = 'BusinessAccountBoundException';
  }
}
