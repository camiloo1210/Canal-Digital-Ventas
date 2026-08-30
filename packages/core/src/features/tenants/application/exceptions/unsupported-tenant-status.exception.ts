import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class UnsupportedTenantStatusException extends ApplicationException {
  constructor(status: string) {
    super(`Unsupported status transition to ${status}`);
  }
}
