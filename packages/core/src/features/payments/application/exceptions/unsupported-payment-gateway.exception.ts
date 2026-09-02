import { ApplicationException } from '@/shared/application/exceptions/application.exception';
import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';

export class UnsupportedPaymentGatewayException extends ApplicationException {
  constructor(gateway: PaymentGateway) {
    super(`The payment gateway ${gateway} is not supported or not implemented.`);
    this.name = 'UnsupportedPaymentGatewayException';
  }
}
