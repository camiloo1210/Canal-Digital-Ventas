export enum PaymentGateway {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  MANUAL = 'manual',
  LEMON_SQUEEZY = 'lemon_squeezy',
}

import { InvalidPaymentAttributeException } from '@/payments/domain/exceptions/invalid-payment-attribute.exception';

export function parsePaymentGateway(value: string): PaymentGateway {
  const values = Object.values(PaymentGateway) as string[];
  if (!values.includes(value)) {
    throw new InvalidPaymentAttributeException(`Invalid payment gateway: ${value}`);
  }
  return value as PaymentGateway;
}
