import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidOrderAttributeException extends DomainException {
  constructor(reason: string) {
    super(`Invalid order attribute: ${reason}`);
  }
}
