import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class CategoryNotFoundException extends ApplicationException {
  constructor(id: string) {
    super(`Category with ID '${id}' was not found.`);
  }
}
