import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class AuthGatewayException extends ApplicationException {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'AuthGatewayException';
  }
}
