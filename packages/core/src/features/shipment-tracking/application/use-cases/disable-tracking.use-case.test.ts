import { describe, expect, it, vi } from 'vitest';
import { DisableTrackingUseCase } from '@/shipment-tracking/application/use-cases/disable-tracking.use-case';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
const input = {
  tenantId: crypto.randomUUID(),
  orderId: crypto.randomUUID(),
  authenticatedSellerId: crypto.randomUUID(),
  expectedShipmentVersion: 2,
};
describe('disable shipment tracking', (): void => {
  it('checks permission and version before disabling within the transaction', async (): Promise<void> => {
    const tx: TransactionContext = { executeNative: vi.fn() };
    const transactions: TransactionManagerPort = {
      runInTransaction: async <T>(fn: (context: TransactionContext) => Promise<T>): Promise<T> =>
        fn(tx),
    };
    const access = vi.fn();
    const disable = vi.fn();
    const useCase = new DisableTrackingUseCase(
      { assertCanManage: access },
      { readForUpdate: vi.fn().mockResolvedValue({ trackingNumber: '123', version: 2 }), disable },
      transactions,
      true,
    );
    await useCase.execute(input);
    expect(access).toHaveBeenCalledWith(
      input.authenticatedSellerId,
      input.tenantId,
      input.orderId,
      tx,
    );
    expect(disable).toHaveBeenCalledWith(input.tenantId, input.orderId, tx);
  });
  it('rejects stale shipment versions without disabling', async (): Promise<void> => {
    const tx: TransactionContext = { executeNative: vi.fn() };
    const transactions: TransactionManagerPort = {
      runInTransaction: async <T>(fn: (context: TransactionContext) => Promise<T>): Promise<T> =>
        fn(tx),
    };
    const disable = vi.fn();
    const useCase = new DisableTrackingUseCase(
      { assertCanManage: vi.fn() },
      { readForUpdate: vi.fn().mockResolvedValue({ trackingNumber: '123', version: 3 }), disable },
      transactions,
      true,
    );
    await expect(useCase.execute(input)).rejects.toThrow();
    expect(disable).not.toHaveBeenCalled();
  });
});
