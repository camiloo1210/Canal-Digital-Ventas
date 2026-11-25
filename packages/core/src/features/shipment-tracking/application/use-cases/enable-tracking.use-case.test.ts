import { describe, expect, it, vi } from 'vitest';
import { EnableTrackingUseCase } from '@/shipment-tracking/application/use-cases/enable-tracking.use-case';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

const request = {
  tenantId: crypto.randomUUID(),
  orderId: crypto.randomUUID(),
  authenticatedSellerId: crypto.randomUUID(),
  expectedShipmentVersion: 2,
  provider: 'fedex' as const,
};
function setup(): {
  useCase: EnableTrackingUseCase;
  authorize: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  enable: ReturnType<typeof vi.fn>;
} {
  const authorize = vi.fn().mockResolvedValue(undefined);
  const read = vi.fn().mockResolvedValue({ trackingNumber: '123', version: 2 });
  const enable = vi.fn().mockResolvedValue(undefined);
  const tx: TransactionContext = { executeNative: vi.fn() };
  const transactions: TransactionManagerPort = {
    runInTransaction: async <T>(operation: (tx: TransactionContext) => Promise<T>): Promise<T> =>
      operation(tx),
  };
  return {
    useCase: new EnableTrackingUseCase(
      { assertCanManage: authorize },
      { readForUpdate: read, enable },
      transactions,
      true,
    ),
    authorize,
    read,
    enable,
  };
}
describe('enable shipment tracking', (): void => {
  it('enables a confirmed guide only after tenant authorization', async (): Promise<void> => {
    const f = setup();
    await f.useCase.execute(request);
    expect(f.enable).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: request.tenantId,
        orderId: request.orderId,
        trackingNumber: '123',
        provider: 'fedex',
      }),
      expect.anything(),
    );
  });
  it('never activates tracking when sandbox is disabled', async (): Promise<void> => {
    const authorize = vi.fn();
    const enable = vi.fn();
    const tx: TransactionContext = { executeNative: vi.fn() };
    const transactions: TransactionManagerPort = {
      runInTransaction: async <T>(operation: (tx: TransactionContext) => Promise<T>): Promise<T> =>
        operation(tx),
    };
    const useCase = new EnableTrackingUseCase(
      { assertCanManage: authorize },
      { readForUpdate: vi.fn(), enable },
      transactions,
      false,
    );
    await expect(useCase.execute(request)).rejects.toThrow();
    expect(enable).not.toHaveBeenCalled();
  });
  it('does not activate when seller is unauthorized', async (): Promise<void> => {
    const f = setup();
    f.authorize.mockRejectedValue(new Error('unauthorized'));
    await expect(f.useCase.execute(request)).rejects.toThrow('unauthorized');
    expect(f.enable).not.toHaveBeenCalled();
  });
  it('rejects missing and stale shipment data', async (): Promise<void> => {
    const f = setup();
    f.read
      .mockResolvedValueOnce({ trackingNumber: null, version: 2 })
      .mockResolvedValueOnce({ trackingNumber: '123', version: 3 });
    await expect(f.useCase.execute(request)).rejects.toThrow();
    await expect(f.useCase.execute(request)).rejects.toThrow();
    expect(f.enable).not.toHaveBeenCalled();
  });
});
