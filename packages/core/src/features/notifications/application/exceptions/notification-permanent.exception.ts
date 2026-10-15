import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class NotificationPermanentException extends ApplicationException {
  constructor(public readonly code: string) {
    super(code);
  }
}
