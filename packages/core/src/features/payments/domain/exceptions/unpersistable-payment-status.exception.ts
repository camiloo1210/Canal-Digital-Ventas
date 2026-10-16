import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class UnpersistablePaymentStatusException extends DomainException {
  constructor(rawStatus: string) {
    super(`Refusing to persist payment in read-only status "${rawStatus}" from the legacy writer.`);
  }
}
