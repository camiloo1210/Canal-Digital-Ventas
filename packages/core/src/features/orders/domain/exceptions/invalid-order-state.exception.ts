import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidOrderStateException extends DomainException {
  constructor(reason: string) {
    super(`Invalid order state: ${reason}`);
  }
}
