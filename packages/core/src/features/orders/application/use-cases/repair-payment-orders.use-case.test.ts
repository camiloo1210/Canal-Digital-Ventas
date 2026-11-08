import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RepairPaymentOrdersUseCase } from '@/orders/application/use-cases/repair-payment-orders.use-case';
import { MarkOrderPaidUseCase } from '@/orders/application/use-cases/mark-order-paid.use-case';
import type { CancelExpiredOrderUseCase } from '@/orders/application/use-cases/cancel-expired-order.use-case';
import type { ApplyObservedRefundToOrderUseCase } from '@/orders/application/use-cases/apply-observed-refund-to-order.use-case';
import type {
  PaymentOrderRepairCandidate,
  PaymentOrderRepairReadPort,
} from '@/orders/application/ports/out/payment-order-repair-read.port';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import type { OrderId } from '@/orders/domain/types/order-id.type';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';
import {
  buildPayableOrder,
  PAYABLE_ORDER_ID,
  PAYABLE_ORDER_TENANT_ID,
  PAYABLE_ORDER_TOTAL_CENTS,
} from '@/testing/builders/payable-order.builder';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { FakeTransactionManager } from '@/testing/fakes/fake-transaction-manager';
import { FakeOrderPaymentCoordination } from '@/testing/fakes/fake-order-payment-coordination';
import {
  FakeOrderLifecycleRepository,
  FakeOrderPaymentAutomation,
} from '@/testing/fakes/fake-order-payment-automation';

type Result = 'APPLIED' | 'NOOP' | 'MISMATCH' | 'EXCLUDED';
type Stub = { execute: ReturnType<typeof vi.fn<(dto: unknown) => Promise<Result>>> };

function stub(...results: Result[]): Stub {
  const execute = vi.fn<(dto: unknown) => Promise<Result>>();
  for (const result of results) execute.mockResolvedValueOnce(result);
  return { execute };
}

function candidate(
  operation: PaymentOrderRepairCandidate['operation'],
): PaymentOrderRepairCandidate {
  return {
    operation,
    orderId: PAYABLE_ORDER_ID,
    tenantId: PAYABLE_ORDER_TENANT_ID,
    paymentId: 'payment-1',
  };
}

class StaticRepairRead implements PaymentOrderRepairReadPort {
  public limits: number[] = [];
  public constructor(private readonly due: PaymentOrderRepairCandidate[]) {}
  async findDue(limit: number): Promise<PaymentOrderRepairCandidate[]> {
    this.limits.push(limit);
    return this.due;
  }
}

describe('RepairPaymentOrdersUseCase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function build(
    due: PaymentOrderRepairCandidate[],
    paid: Stub,
    expired: Stub,
    refunded: Stub,
  ): {
    read: StaticRepairRead;
    useCase: RepairPaymentOrdersUseCase;
  } {
    const read = new StaticRepairRead(due);
    const useCase = new RepairPaymentOrdersUseCase(
      read,
      paid as unknown as MarkOrderPaidUseCase,
      expired as unknown as CancelExpiredOrderUseCase,
      refunded as unknown as ApplyObservedRefundToOrderUseCase,
    );
    return { read, useCase };
  }

  it('returns zero counts and calls nothing when no candidate is due', async (): Promise<void> => {
    const [paid, expired, refunded] = [stub(), stub(), stub()];
    const { read, useCase } = build([], paid, expired, refunded);

    await expect(useCase.execute()).resolves.toEqual({ applied: 0, reviewRequired: 0 });

    expect(read.limits).toEqual([100]);
    expect(paid.execute).not.toHaveBeenCalled();
  });

  it('routes each operation to its own use case with the candidate', async (): Promise<void> => {
    const [paid, expired, refunded] = [stub('APPLIED'), stub('APPLIED'), stub('APPLIED')];
    const due = [candidate('PAID'), candidate('EXPIRE'), candidate('REFUND')];
    const { useCase } = build(due, paid, expired, refunded);

    await useCase.execute();

    expect(paid.execute).toHaveBeenCalledExactlyOnceWith(due[0]);
    expect(expired.execute).toHaveBeenCalledExactlyOnceWith(due[1]);
    expect(refunded.execute).toHaveBeenCalledExactlyOnceWith(due[2]);
  });

  it('counts APPLIED as applied, MISMATCH and EXCLUDED as reviewRequired, NOOP as neither', async (): Promise<void> => {
    const paid = stub('APPLIED', 'MISMATCH', 'NOOP');
    const expired = stub('EXCLUDED');
    const refunded = stub('APPLIED');
    const due = [
      candidate('PAID'),
      candidate('PAID'),
      candidate('EXPIRE'),
      candidate('PAID'),
      candidate('REFUND'),
    ];
    const { useCase } = build(due, paid, expired, refunded);

    await expect(useCase.execute()).resolves.toEqual({ applied: 2, reviewRequired: 2 });
  });

  it('propagates a collaborator failure instead of hiding it (earlier work is already committed)', async (): Promise<void> => {
    const paid = stub('APPLIED');
    const failure = new Error('database unavailable');
    const expired = {
      execute: vi.fn<(dto: unknown) => Promise<Result>>().mockRejectedValue(failure),
    };
    const { useCase } = build([candidate('PAID'), candidate('EXPIRE')], paid, expired, stub());

    await expect(useCase.execute()).rejects.toBe(failure);
    expect(paid.execute).toHaveBeenCalledTimes(1);
  });

  describe('with the real MarkOrderPaidUseCase over fakes', () => {
    it('is idempotent: the second run applies nothing and writes nothing', async (): Promise<void> => {
      const orders = new FakeOrderLifecycleRepository();
      orders.seed(buildPayableOrder({ status: OrderStatus.CONFIRMED }));
      const payments = new FakeOrderPaymentAutomation();
      payments.seed(PAYABLE_ORDER_ID, {
        paymentId: 'payment-1',
        tenantId: PAYABLE_ORDER_TENANT_ID,
        status: 'completed',
        amountCents: PAYABLE_ORDER_TOTAL_CENTS,
        providerOrderId: 'ls-123',
        environment: 'test',
        excluded: false,
      });
      const events = new FakeEventBus();
      const transactions = new FakeTransactionManager();
      const paid = new MarkOrderPaidUseCase(
        orders,
        new FakeOrderPaymentCoordination(),
        payments,
        events,
        transactions,
        'system-actor',
      );
      const read = new StaticRepairRead([candidate('PAID')]);
      const useCase = new RepairPaymentOrdersUseCase(
        read,
        paid,
        stub() as unknown as CancelExpiredOrderUseCase,
        stub() as unknown as ApplyObservedRefundToOrderUseCase,
      );

      await expect(useCase.execute()).resolves.toEqual({ applied: 1, reviewRequired: 0 });
      await expect(useCase.execute()).resolves.toEqual({ applied: 0, reviewRequired: 0 });

      const order = await orders.peek(
        PAYABLE_ORDER_ID as OrderId,
        PAYABLE_ORDER_TENANT_ID as TenantId,
      );
      expect(order?.getStatus()).toBe(OrderStatus.PAID);
      expect(order?.getPaymentGatewayId()).toBe('ls-123');
      expect(orders.saveCount).toBe(1);
      expect(events.published.map((envelope): string => envelope.event.eventName)).toEqual([
        'OrderPaidEvent',
      ]);
      expect(transactions.committed).toBe(2);
      expect(transactions.calls[0]).toEqual({ userId: 'system-actor', tenantId: 'tenant-1' });
    });

    it('reports reviewRequired and writes nothing when the provider amount differs from the order total', async (): Promise<void> => {
      const orders = new FakeOrderLifecycleRepository();
      orders.seed(buildPayableOrder());
      const payments = new FakeOrderPaymentAutomation();
      payments.seed(PAYABLE_ORDER_ID, {
        paymentId: 'payment-1',
        tenantId: PAYABLE_ORDER_TENANT_ID,
        status: 'completed',
        amountCents: PAYABLE_ORDER_TOTAL_CENTS - 1,
        providerOrderId: 'ls-123',
        environment: 'test',
        excluded: false,
      });
      const events = new FakeEventBus();
      const paid = new MarkOrderPaidUseCase(
        orders,
        new FakeOrderPaymentCoordination(),
        payments,
        events,
        new FakeTransactionManager(),
        'system-actor',
      );
      const useCase = new RepairPaymentOrdersUseCase(
        new StaticRepairRead([candidate('PAID')]),
        paid,
        stub() as unknown as CancelExpiredOrderUseCase,
        stub() as unknown as ApplyObservedRefundToOrderUseCase,
      );

      await expect(useCase.execute()).resolves.toEqual({ applied: 0, reviewRequired: 1 });

      expect(orders.saveCount).toBe(0);
      expect(events.published).toEqual([]);
    });
  });
});
