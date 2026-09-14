import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class PaymentGatewayException extends InfrastructureException {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'PaymentGatewayException';
  }
}
