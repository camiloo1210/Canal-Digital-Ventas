import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class AdminAuthException extends ApplicationException {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AdminAuthException';
  }
}
