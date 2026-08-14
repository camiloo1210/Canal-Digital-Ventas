import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class UnsupportedOrderStatusException extends ApplicationException {
  constructor(status: string) {
    super(`Cannot manually change status to ${status} through this use case.`);
  }
}
