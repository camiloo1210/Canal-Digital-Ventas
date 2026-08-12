import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class CategoryNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Category with ID '${id}' was not found.`);
  }
}
