import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCategoryAttributeException extends DomainException {
  constructor(reason: string) {
    super(`Invalid category attribute: ${reason}`);
  }
}
