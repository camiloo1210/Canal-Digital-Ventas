import { ApplicationException } from '@/shared/application/exceptions/application.exception';
import { PaymentId } from '@/payments/domain/types/payment-id.type';

export class PaymentNotFoundException extends ApplicationException {
  constructor(paymentId?: PaymentId) {
    const message = paymentId
      ? `Payment with ID ${paymentId} was not found.`
      : 'Payment not found.';
    super(message);
    this.name = 'PaymentNotFoundException';
  }
}
