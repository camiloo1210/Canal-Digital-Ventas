import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class UnsupportedCustomerStatusException extends ApplicationException {
  constructor(status: string) {
    super(`The customer status '${status}' is not supported for this operation.`);
    this.name = 'UnsupportedCustomerStatusException';
  }
}
