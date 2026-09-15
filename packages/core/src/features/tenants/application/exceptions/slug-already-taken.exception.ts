import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class SlugAlreadyTakenException extends ApplicationException {
  constructor(slug: string) {
    super(`The store URL "${slug}" is already taken. Please choose another one.`);
  }
}
