import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class UnsupportedCustomerStatusException extends DomainException {
  constructor(status: string) {
    super(`The customer status '${status}' is not supported for this operation.`);
    this.name = 'UnsupportedCustomerStatusException';
  }
}
