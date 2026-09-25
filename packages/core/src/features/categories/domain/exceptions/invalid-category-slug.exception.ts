import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCategorySlugException extends DomainException {
  constructor(message: string) {
    super(`Invalid Category Slug: ${message}`);
    this.name = 'InvalidCategorySlugException';
  }
}
