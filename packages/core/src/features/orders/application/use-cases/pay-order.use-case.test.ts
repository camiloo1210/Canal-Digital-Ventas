import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PayOrderUseCase } from '@/orders/application/use-cases/pay-order.use-case';
import type { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';
import { Order } from '@/orders/domain/entities/order.entity';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import type { OrderId } from '@/orders/domain/types/order-id.type';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import {
  buildPayableOrder,
  PAYABLE_ORDER_ID,
  PAYABLE_ORDER_TENANT_ID,
} from '@/testing/builders/payable-order.builder';

/** Tenant-scoped, counting order store local to this suite. */
class StubOrderRepository implements OrderRepositoryPort {
  public readonly orders = new Map<string, Order>();
  public saveCount = 0;

  public seed(order: Order): void {
    this.orders.set(`${order.getTenantId()}::${order.getId()}`, order);
  }
  async save(order: Order): Promise<void> {
    this.saveCount++;
    this.seed(order);
  }
  async findById(id: OrderId, tenantId?: TenantId): Promise<Order | null> {
    return this.orders.get(`${tenantId}::${id}`) ?? null;
  }
  async findPendingByCustomerId(): Promise<Order | null> {
    return null;
  }
  async findAll(): Promise<never> {
    throw new Error('not used');
  }
  async searchByFilters(): Promise<never> {
    throw new Error('not used');
  }
}

describe('PayOrderUseCase', () => {
  let repository: StubOrderRepository;
  let eventBus: FakeEventBus;
  let useCase: PayOrderUseCase;
  const dto = {
    orderId: PAYABLE_ORDER_ID,
    tenantId: PAYABLE_ORDER_TENANT_ID,
    paymentGatewayId: 'gw-123',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    repository = new StubOrderRepository();
    eventBus = new FakeEventBus();
    useCase = new PayOrderUseCase(repository, eventBus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED])(
    'marks a %s order as paid, saves once and publishes OrderPaidEvent',
    async (status): Promise<void> => {
      repository.seed(buildPayableOrder({ status }));

      await useCase.execute(dto);

      const saved = await repository.findById(
        PAYABLE_ORDER_ID as OrderId,
        PAYABLE_ORDER_TENANT_ID as TenantId,
      );
      expect(saved?.getStatus()).toBe(OrderStatus.PAID);
      expect(saved?.getPaymentGatewayId()).toBe('gw-123');
      expect(repository.saveCount).toBe(1);
      expect(eventBus.publishedLegacy.map((event): string => event.eventName)).toEqual([
        'OrderPaidEvent',
      ]);
    },
  );

  it.each([
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ])('rejects an order in %s and writes nothing', async (status): Promise<void> => {
    repository.seed(buildPayableOrder({ status }));

    await expect(useCase.execute(dto)).rejects.toThrow(InvalidOrderStateException);

    expect(repository.saveCount).toBe(0);
    expect(eventBus.publishedLegacy).toEqual([]);
    expect(eventBus.published).toEqual([]);
  });

  it('is not idempotent: a second payment of the same order fails and does not republish', async (): Promise<void> => {
    repository.seed(buildPayableOrder());
    await useCase.execute(dto);

    await expect(useCase.execute(dto)).rejects.toThrow(InvalidOrderStateException);

    expect(repository.saveCount).toBe(1);
    expect(eventBus.publishedLegacy).toHaveLength(1);
  });

  it('throws OrderNotFoundException for an unknown order', async (): Promise<void> => {
    await expect(useCase.execute(dto)).rejects.toThrow(OrderNotFoundException);
    expect(repository.saveCount).toBe(0);
    expect(eventBus.publishedLegacy).toEqual([]);
  });

  it('does not see an order that belongs to another tenant (anti-IDOR)', async (): Promise<void> => {
    repository.seed(buildPayableOrder());

    await expect(useCase.execute({ ...dto, tenantId: 'tenant-2' })).rejects.toThrow(
      OrderNotFoundException,
    );

    expect(repository.saveCount).toBe(0);
    expect(eventBus.publishedLegacy).toEqual([]);
  });

  it('rejects an empty payment gateway id before touching the repository', async (): Promise<void> => {
    repository.seed(buildPayableOrder());

    await expect(useCase.execute({ ...dto, paymentGatewayId: '  ' })).rejects.toThrow(
      InvalidOrderAttributeException,
    );

    expect(repository.saveCount).toBe(0);
    expect(eventBus.publishedLegacy).toEqual([]);
  });
});
