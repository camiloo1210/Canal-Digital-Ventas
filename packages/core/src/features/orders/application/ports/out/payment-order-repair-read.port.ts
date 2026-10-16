import type { OrderPaymentEventDto } from '@/orders/application/ports/out/order-payment-automation.port';
export interface PaymentOrderRepairCandidate extends OrderPaymentEventDto {
  readonly operation: 'PAID' | 'EXPIRE' | 'REFUND';
}
export interface PaymentOrderRepairReadPort {
  findDue(limit: number): Promise<PaymentOrderRepairCandidate[]>;
}
