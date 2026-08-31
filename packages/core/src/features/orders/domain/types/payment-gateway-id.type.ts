import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';

export type PaymentGatewayId = Brand<string, 'PaymentGatewayId'>;

export function createPaymentGatewayId(id: string): PaymentGatewayId {
  if (!id || id.trim().length === 0) {
    throw new InvalidOrderAttributeException('Payment Gateway ID cannot be empty');
  }
  return id as PaymentGatewayId;
}
