import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidTenantIdException extends DomainException {
  constructor(reason: string) {
    super(`Invalid tenant id: ${reason}`);
  }
}
