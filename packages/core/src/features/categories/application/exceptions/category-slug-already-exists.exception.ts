import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class CategorySlugAlreadyExistsException extends ApplicationException {
  constructor(tenantId: string, slug: string) {
    super(`A category with slug '${slug}' already exists for tenant '${tenantId}'.`);
    this.name = 'CategorySlugAlreadyExistsException';
  }
}
