import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class CustomerNotFoundException extends ApplicationException {
  constructor(message: string = 'Customer not found.') {
    super(message);
    this.name = 'CustomerNotFoundException';
  }
}
