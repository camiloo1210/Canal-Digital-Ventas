import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCategoryDescriptionException extends DomainException {
  constructor(reason: string) {
    super(`Invalid category description: ${reason}`);
  }
}
