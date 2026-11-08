import type {
  OrderPaymentCoordinationPort,
  OrderPaymentSnapshot,
} from '@/orders/application/ports/out/order-payment-coordination.port';
import type { OrderId } from '@/orders/domain/types/order-id.type';

/** Records lock requests; returns a configurable snapshot (null by default). */
export class FakeOrderPaymentCoordination implements OrderPaymentCoordinationPort {
  public readonly locked: string[] = [];

  public constructor(private readonly snapshot: OrderPaymentSnapshot | null = null) {}

  async lockAndReadPayment(orderId: OrderId): Promise<OrderPaymentSnapshot | null> {
    this.locked.push(orderId);
    return this.snapshot;
  }
}
