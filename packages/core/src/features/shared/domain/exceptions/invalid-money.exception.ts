import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidMoneyException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
