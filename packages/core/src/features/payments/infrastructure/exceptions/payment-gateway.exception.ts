import { InfrastructureException } from '@/shared/infrastructure/exceptions/infrastructure.exception';

export class PaymentGatewayException extends InfrastructureException {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentGatewayException';
  }
}
