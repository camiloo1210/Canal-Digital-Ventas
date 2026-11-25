import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidShippingOriginException extends DomainException {
  constructor(reason: string) {
    super(`Invalid shipping origin: ${reason}`);
    this.name = 'InvalidShippingOriginException';
  }
}
