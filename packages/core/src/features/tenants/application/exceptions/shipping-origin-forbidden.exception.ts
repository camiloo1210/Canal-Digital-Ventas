import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class ShippingOriginForbiddenException extends ApplicationException {
  constructor() {
    super('Only members who manage the store can change its shipping origin');
    this.name = 'ShippingOriginForbiddenException';
  }
}
