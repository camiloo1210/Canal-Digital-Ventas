import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class CustomerNotFoundException extends DomainException {
  constructor(message: string = 'Customer not found.') {
    super(message);
    this.name = 'CustomerNotFoundException';
  }
}
