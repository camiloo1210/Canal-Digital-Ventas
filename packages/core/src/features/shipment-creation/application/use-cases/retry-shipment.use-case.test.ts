import { describe, expect, it, vi } from 'vitest';
import { RetryShipmentUseCase } from '@/shipment-creation/application/use-cases/retry-shipment.use-case';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { ShipmentNotRetryableException } from '@/shipment-creation/application/exceptions/shipment-not-retryable.exception';
import { ShipmentRetryNotAllowedException } from '@/shipment-creation/application/exceptions/shipment-retry-not-allowed.exception';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

const tenantId = crypto.randomUUID();
const orderId = crypto.randomUUID();
const actor = crypto.randomUUID();
const dto = { orderId, tenantId, authenticatedSellerId: actor };

function fixture(retryResult: boolean | Error = true): {
  useCase: RetryShipmentUseCase;
  access: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
  tx: TransactionContext;
  transactions: TransactionManagerPort;
} {
  const tx: TransactionContext = { executeNative: vi.fn() };
  const access = vi.fn().mockResolvedValue(undefined);
  const retry =
    retryResult instanceof Error
      ? vi.fn().mockRejectedValue(retryResult)
      : vi.fn().mockResolvedValue(retryResult);
  const transactions: TransactionManagerPort = {
    runInTransaction: async <T>(op: (c: TransactionContext) => Promise<T>): Promise<T> => op(tx),
  };
  vi.spyOn(transactions, 'runInTransaction');
  return {
    tx,
    access,
    retry,
    transactions,
    useCase: new RetryShipmentUseCase({ assertCanManage: access }, { retry }, transactions),
  };
}

describe('RetryShipmentUseCase', (): void => {
  it('authorizes the seller on the tenant order, then re-queues', async (): Promise<void> => {
    const f = fixture(true);
    await f.useCase.execute(dto);
    expect(f.transactions.runInTransaction).toHaveBeenCalledWith(expect.any(Function), {
      userId: actor,
      tenantId,
    });
    expect(f.access).toHaveBeenCalledWith(actor, tenantId, orderId, f.tx);
    expect(f.retry).toHaveBeenCalledWith(tenantId, orderId, actor);
    expect(f.access.mock.invocationCallOrder[0]).toBeLessThan(f.retry.mock.invocationCallOrder[0]);
  });

  it('rejects a seller of another tenant without touching the job repository', async (): Promise<void> => {
    const f = fixture(true);
    f.access.mockRejectedValue(new OrderNotFoundException());
    await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(OrderNotFoundException);
    expect(f.retry).not.toHaveBeenCalled();
  });

  it('rejects a retry from a state that is not needs_attention or failed (e.g. done)', async (): Promise<void> => {
    const f = fixture(false);
    await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(ShipmentNotRetryableException);
  });

  it('propagates the refusal when the carrier already created the shipment', async (): Promise<void> => {
    const f = fixture(new ShipmentRetryNotAllowedException());
    await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(ShipmentRetryNotAllowedException);
  });

  it('rejects malformed identifiers before any I/O', async (): Promise<void> => {
    const f = fixture(true);
    await expect(f.useCase.execute({ ...dto, orderId: '' })).rejects.toThrow();
    expect(f.access).not.toHaveBeenCalled();
  });
});
