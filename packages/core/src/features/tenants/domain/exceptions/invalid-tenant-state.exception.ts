import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidTenantStateException extends DomainException {
  constructor(reason: string) {
    super(`Invalid tenant state: ${reason}`);
  }
}
