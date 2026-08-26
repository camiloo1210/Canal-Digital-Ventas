import { DomainException } from '@/shared/domain/exceptions/domain.exception';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';

export class UnsupportedCustomerStatusException extends DomainException {
  constructor(status: CustomerStatus) {
    super(`The customer status '${status}' is not supported for this operation.`);
    this.name = 'UnsupportedCustomerStatusException';
  }
}
