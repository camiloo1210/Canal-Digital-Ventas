import { describe, expect, it, vi } from 'vitest';
import { ChangeOrderStatusUseCase } from '@/orders/application/use-cases/change-order-status.use-case';
import { Order } from '@/orders/domain/entities/order.entity';
import { OrderStatus, nextLogisticsStatus } from '@/orders/domain/enums/order-status.enum';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createCustomerId } from '@/orders/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import type { OrderPaymentSnapshot } from '@/orders/application/ports/out/order-payment-coordination.port';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import { UnsupportedOrderStatusException } from '@/orders/application/exceptions/unsupported-order-status.exception';

const orderId = crypto.randomUUID();
const tenantId = crypto.randomUUID();
const actor = crypto.randomUUID();
const dto = {
  orderId,
  tenantId,
  authenticatedSellerId: actor,
  status: 'processing',
  expectedVersion: 3,
};

function order(status: OrderStatus): Order {
  return Order.reconstitute({
    id: createOrderId(orderId),
    customerId: createCustomerId(crypto.randomUUID()),
    tenantId: createTenantId(tenantId),
    orderNumber: 'ORD-LOGISTICS',
    status,
    items: [],
    subtotal: Money.from(100),
    taxAmount: Money.from(0),
    discountAmount: Money.from(0),
    shippingCost: Money.from(0),
    totalAmount: Money.from(100),
    shippingAddress: Address.create('Street 1', 'City', 'State', '12345', 'US'),
    paymentGatewayId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 3,
  });
}

function fixture(status: OrderStatus = OrderStatus.PAID): {
  useCase: ChangeOrderStatusUseCase;
  entity: Order;
  access: ReturnType<typeof vi.fn>;
  coordination: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  tx: TransactionContext;
  transactions: TransactionManagerPort;
} {
  const entity = order(status);
  const tx: TransactionContext = { executeNative: vi.fn() };
  const access = vi.fn().mockResolvedValue(undefined);
  const coordination = vi.fn().mockResolvedValue({
    paymentId: crypto.randomUUID(),
    status: 'completed',
  } satisfies OrderPaymentSnapshot);
  const save = vi.fn().mockResolvedValue(undefined);
  const publish = vi.fn().mockResolvedValue(undefined);
  const read = vi.fn().mockResolvedValue(entity);
  const transactions: TransactionManagerPort = {
    runInTransaction: async <T>(
      operation: (context: TransactionContext) => Promise<T>,
    ): Promise<T> => operation(tx),
  };
  vi.spyOn(transactions, 'runInTransaction');
  return {
    entity,
    access,
    coordination,
    save,
    publish,
    read,
    tx,
    transactions,
    useCase: new ChangeOrderStatusUseCase(
      { findByIdForUpdate: read, saveLifecycle: save },
      { assertCanManage: access },
      { lockAndReadPayment: coordination },
      { publish },
      transactions,
    ),
  };
}

describe('seller fulfillment transitions', (): void => {
  it.each([
    [OrderStatus.PAID, OrderStatus.PROCESSING, 'OrderProcessingEvent'],
    [OrderStatus.PROCESSING, OrderStatus.SHIPPED, 'OrderShippedEvent'],
    [OrderStatus.SHIPPED, OrderStatus.DELIVERED, 'OrderDeliveredEvent'],
  ])(
    'advances %s to %s and atomically persists its event',
    async (from, to, eventName): Promise<void> => {
      const f = fixture(from);
      await f.useCase.execute({ ...dto, status: to });
      expect(f.entity.getStatus()).toBe(to);
      expect(f.entity.getVersion()).toBe(4);
      expect(f.transactions.runInTransaction).toHaveBeenCalledWith(expect.any(Function), {
        userId: actor,
        tenantId,
      });
      expect(f.access).toHaveBeenCalledWith(actor, tenantId, orderId, f.tx);
      expect(f.coordination.mock.invocationCallOrder[0]).toBeGreaterThan(
        f.access.mock.invocationCallOrder[0],
      );
      expect(f.save).toHaveBeenCalledWith(f.entity, f.tx);
      expect(f.publish).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            context: { tenantId, aggregateType: 'Order', aggregateId: orderId },
            event: expect.objectContaining({ eventName, orderId }),
          }),
        ],
        f.tx,
      );
      expect(f.entity.domainEvents).toHaveLength(0);
    },
  );

  it('rejects another tenant or an unauthorized actor before reading payment data', async (): Promise<void> => {
    const f = fixture();
    f.access.mockRejectedValue(new OrderNotFoundException());
    await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(OrderNotFoundException);
    expect(f.coordination).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });

  it('rejects a missing tenant-scoped order', async (): Promise<void> => {
    const f = fixture();
    f.read.mockResolvedValue(null);
    await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(OrderNotFoundException);
    expect(f.save).not.toHaveBeenCalled();
  });

  it('rejects a stale submission without emitting another event', async (): Promise<void> => {
    const f = fixture();
    await expect(f.useCase.execute({ ...dto, expectedVersion: 2 })).rejects.toBeInstanceOf(
      OptimisticConcurrencyException,
    );
    expect(f.save).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  });

  it.each(['paid', 'cancelled', 'refunded', 'confirmed'])(
    'does not allow the seller to set %s manually',
    async (status): Promise<void> => {
      const f = fixture();
      await expect(f.useCase.execute({ ...dto, status })).rejects.toBeInstanceOf(
        UnsupportedOrderStatusException,
      );
      expect(f.transactions.runInTransaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    'pending',
    'refunded',
    'expired_unpaid_awaiting_reconciliation',
    'late_payment_pending_compensation',
  ])('does not fulfill a payment in %s', async (status): Promise<void> => {
    const f = fixture();
    f.coordination.mockResolvedValue({ paymentId: crypto.randomUUID(), status });
    await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(InvalidOrderStateException);
    expect(f.save).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  });

  it('does not fulfill an order without a settled payment', async (): Promise<void> => {
    const f = fixture();
    f.coordination.mockResolvedValue(null);
    await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(InvalidOrderStateException);
    expect(f.save).not.toHaveBeenCalled();
  });

  it.each([
    [OrderStatus.PAID, 'shipped'],
    [OrderStatus.PAID, 'delivered'],
    [OrderStatus.CONFIRMED, 'processing'],
    [OrderStatus.DELIVERED, 'processing'],
    [OrderStatus.SHIPPED, 'processing'],
    [OrderStatus.CANCELLED, 'shipped'],
  ])(
    'rejects a skipped or backward transition from %s to %s',
    async (from, status): Promise<void> => {
      const f = fixture(from);
      await expect(f.useCase.execute({ ...dto, status })).rejects.toBeInstanceOf(
        InvalidOrderStateException,
      );
      expect(f.save).not.toHaveBeenCalled();
      expect(f.publish).not.toHaveBeenCalled();
    },
  );

  it('propagates an outbox failure through the transaction boundary', async (): Promise<void> => {
    const f = fixture();
    const failure = new Error('Outbox unavailable');
    f.publish.mockRejectedValue(failure);
    await expect(f.useCase.execute(dto)).rejects.toBe(failure);
    expect(f.save).toHaveBeenCalledWith(f.entity, f.tx);
    expect(f.entity.domainEvents).toHaveLength(1);
  });

  it('does not emit an event after persistence detects concurrent modification', async (): Promise<void> => {
    const f = fixture();
    f.save.mockRejectedValue(new OptimisticConcurrencyException('Order', orderId));
    await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(OptimisticConcurrencyException);
    expect(f.publish).not.toHaveBeenCalled();
  });

  it('projects only valid next steps, including terminal and unpaid states', (): void => {
    expect(nextLogisticsStatus(OrderStatus.PAID)).toBe(OrderStatus.PROCESSING);
    expect(nextLogisticsStatus(OrderStatus.PROCESSING)).toBe(OrderStatus.SHIPPED);
    expect(nextLogisticsStatus(OrderStatus.SHIPPED)).toBe(OrderStatus.DELIVERED);
    for (const status of [
      OrderStatus.DRAFT,
      OrderStatus.CONFIRMED,
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
    ]) {
      expect(nextLogisticsStatus(status)).toBeNull();
    }
  });
});
