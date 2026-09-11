import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class AuthGatewayException extends DomainException {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'AuthGatewayException';
  }
}
