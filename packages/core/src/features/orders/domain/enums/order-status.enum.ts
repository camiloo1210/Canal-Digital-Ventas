import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';

export enum OrderStatus {
  DRAFT = 'draft',
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export function parseOrderStatus(value: string): OrderStatus {
  const isValid = Object.values(OrderStatus).includes(value as OrderStatus);
  if (!isValid) {
    throw new InvalidOrderAttributeException(`'${value}' no es un estado de orden válido.`);
  }
  return value as OrderStatus;
}
