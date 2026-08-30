import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidTenantAttributeException extends DomainException {
  constructor(reason: string) {
    super(`Invalid tenant attribute: ${reason}`);
  }
}
