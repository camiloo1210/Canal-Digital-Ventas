import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class CartNotFoundException extends ApplicationException {
  constructor(message?: string) {
    super(message || 'Cart not found');
  }
}
