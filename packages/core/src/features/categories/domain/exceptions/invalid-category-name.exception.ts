import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCategoryNameException extends DomainException {
  constructor(reason: string) {
    super(`Invalid category name: ${reason}`);
  }
}
