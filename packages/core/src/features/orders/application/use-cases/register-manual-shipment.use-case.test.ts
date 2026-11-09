import { describe, expect, it, vi } from 'vitest';
import { RegisterManualShipmentUseCase } from '@/orders/application/use-cases/register-manual-shipment.use-case';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import type { Order } from '@/orders/domain/entities/order.entity';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

const input = {
  orderId: crypto.randomUUID(),
  tenantId: crypto.randomUUID(),
  authenticatedSellerId: crypto.randomUUID(),
  expectedShipmentVersion: 0,
  carrier: ' Carrier ',
  trackingNumber: ' ABC ',
};
function fixture(status: OrderStatus = OrderStatus.PROCESSING): {
  useCase: RegisterManualShipmentUseCase;
  access: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  tx: TransactionContext;
} {
  const tx: TransactionContext = { executeNative: vi.fn() };
  const access = vi.fn().mockResolvedValue(undefined);
  const find = vi.fn().mockResolvedValue({ getStatus: (): OrderStatus => status } as Order);
  const save = vi.fn().mockResolvedValue(undefined);
  const publish = vi.fn().mockResolvedValue(undefined);
  const transactions: TransactionManagerPort = {
    runInTransaction: async <T>(
      operation: (context: TransactionContext) => Promise<T>,
    ): Promise<T> => operation(tx),
  };
  return {
    useCase: new RegisterManualShipmentUseCase(
      { assertCanManage: access },
      { findByIdForUpdate: find },
      { save },
      transactions,
      { publish },
    ),
    access,
    find,
    save,
    publish,
    tx,
  };
}
describe('register manual shipment', (): void => {
  it('authorizes the seller and saves normalized details inside one transaction', async (): Promise<void> => {
    const f = fixture();
    await f.useCase.execute(input);
    expect(f.access).toHaveBeenCalledWith(
      input.authenticatedSellerId,
      input.tenantId,
      input.orderId,
      f.tx,
    );
    expect(f.publish).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          context: expect.objectContaining({
            tenantId: input.tenantId,
            aggregateType: 'Order',
            aggregateId: input.orderId,
          }),
          event: expect.objectContaining({
            eventName: 'OrderShipmentUpdatedEvent',
            orderId: input.orderId,
          }),
        }),
      ],
      f.tx,
    );
    expect(f.save).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: input.orderId,
        tenantId: input.tenantId,
        actorId: input.authenticatedSellerId,
        expectedVersion: 0,
        carrier: 'Carrier',
        trackingNumber: 'ABC',
      }),
      f.tx,
    );
  });
  it('invalidates tracking within the shipment transaction when configured', async (): Promise<void> => {
    const tx: TransactionContext = { executeNative: vi.fn() };
    const invalidate = vi.fn().mockResolvedValue(undefined);
    const transactions: TransactionManagerPort = {
      runInTransaction: async <T>(
        operation: (context: TransactionContext) => Promise<T>,
      ): Promise<T> => operation(tx),
    };
    const useCase = new RegisterManualShipmentUseCase(
      { assertCanManage: vi.fn() },
      {
        findByIdForUpdate: vi
          .fn()
          .mockResolvedValue({ getStatus: (): OrderStatus => OrderStatus.PROCESSING } as Order),
      },
      { save: vi.fn() },
      transactions,
      null,
      { invalidateIfChanged: invalidate },
    );
    await useCase.execute(input);
    expect(invalidate).toHaveBeenCalledWith(input.tenantId, input.orderId, 'ABC', tx);
  });
  it('does not create notification events while delivery is disabled', async (): Promise<void> => {
    const tx: TransactionContext = { executeNative: vi.fn() };
    const save = vi.fn().mockResolvedValue(undefined);
    const transactions: TransactionManagerPort = {
      runInTransaction: async <T>(
        operation: (context: TransactionContext) => Promise<T>,
      ): Promise<T> => operation(tx),
    };
    const useCase = new RegisterManualShipmentUseCase(
      { assertCanManage: vi.fn() },
      {
        findByIdForUpdate: vi
          .fn()
          .mockResolvedValue({ getStatus: (): OrderStatus => OrderStatus.PROCESSING } as Order),
      },
      { save },
      transactions,
      null,
    );
    await expect(useCase.execute(input)).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledOnce();
  });
  it('does not save without authorization', async (): Promise<void> => {
    const f = fixture();
    f.access.mockRejectedValue(new OrderNotFoundException());
    await expect(f.useCase.execute(input)).rejects.toThrow(OrderNotFoundException);
    expect(f.save).not.toHaveBeenCalled();
  });
  it('rejects an absent order and ineligible state', async (): Promise<void> => {
    const missing = fixture();
    missing.find.mockResolvedValue(null);
    await expect(missing.useCase.execute(input)).rejects.toThrow(OrderNotFoundException);
    const cancelled = fixture(OrderStatus.CANCELLED);
    await expect(cancelled.useCase.execute(input)).rejects.toThrow(InvalidOrderStateException);
    expect(cancelled.save).not.toHaveBeenCalled();
  });
  it('rejects invalid details and passes version conflicts through', async (): Promise<void> => {
    const f = fixture();
    await expect(
      f.useCase.execute({ ...input, carrier: null, trackingNumber: null }),
    ).rejects.toThrow(InvalidOrderAttributeException);
    f.save.mockRejectedValue(new OptimisticConcurrencyException('Shipment', input.orderId));
    await expect(f.useCase.execute(input)).rejects.toThrow(OptimisticConcurrencyException);
  });
});
