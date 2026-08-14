import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class OrderNotFoundException extends ApplicationException {
  constructor(message?: string) {
    super(message || 'Order not found');
  }
}
