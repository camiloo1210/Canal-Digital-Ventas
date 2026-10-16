import type { Order } from '@/orders/domain/entities/order.entity';
import type { OrderId } from '@/orders/domain/types/order-id.type';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface OrderLifecycleRepositoryPort {
  findByIdForUpdate(id: OrderId, tenantId: TenantId, tx: TransactionContext): Promise<Order | null>;
  saveLifecycle(order: Order, tx: TransactionContext): Promise<void>;
}

export interface OrderAutomationPayment {
  readonly paymentId: string;
  readonly tenantId: string;
  readonly status: string;
  readonly amountCents: number;
  readonly providerOrderId: string | null;
  readonly environment: string;
  readonly excluded: boolean;
}

export interface OrderPaymentAutomationPort {
  read(
    orderId: OrderId,
    tenantId: TenantId,
    tx: TransactionContext,
  ): Promise<OrderAutomationPayment | null>;
  reserveExpiryCancellation(
    orderId: OrderId,
    paymentId: string,
    tenantId: TenantId,
    tx: TransactionContext,
  ): Promise<boolean>;
}

export interface OrderPaymentEventDto {
  readonly orderId: string;
  readonly tenantId: string;
  readonly paymentId: string;
}
