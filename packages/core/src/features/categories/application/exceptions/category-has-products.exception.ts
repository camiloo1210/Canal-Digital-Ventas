import { ApplicationException } from '@/shared/application/exceptions/application.exception';

/** A category that still has products cannot be archived: they would lose their family. */
export class CategoryHasProductsException extends ApplicationException {
  constructor(id: string, productCount: number) {
    super(`Category '${id}' still has ${productCount} product(s) and cannot be archived.`);
    this.name = 'CategoryHasProductsException';
  }
}
