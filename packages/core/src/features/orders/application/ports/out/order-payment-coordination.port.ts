import type { OrderId } from '@/orders/domain/types/order-id.type';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface OrderPaymentSnapshot {
  readonly paymentId: string;
  readonly status: string;
}

export interface OrderPaymentCoordinationPort {
  /** Same order advisory lock as the payment RPCs, then the order row lock. */
  lockAndReadPayment(
    orderId: OrderId,
    tx: TransactionContext,
  ): Promise<OrderPaymentSnapshot | null>;
}
