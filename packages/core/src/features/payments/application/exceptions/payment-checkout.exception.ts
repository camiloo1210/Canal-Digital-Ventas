import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export type PaymentCheckoutErrorCode =
  | 'BUSY'
  | 'CREATION_UNAVAILABLE'
  | 'CHECKOUT_REJECTED'
  | 'NOT_FOUND'
  | 'NOT_CONFIGURED'
  | 'DISABLED'
  | 'INVALID_RESERVATION';

export class PaymentCheckoutException extends ApplicationException {
  public constructor(public readonly code: PaymentCheckoutErrorCode) {
    super('The payment checkout is not available.');
  }
}
