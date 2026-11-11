import { describe, expect, it, vi } from 'vitest';
import { SetBuyerWholesaleUseCase } from '@/iam/application/use-cases/set-buyer-wholesale.use-case';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

describe('SetBuyerWholesaleUseCase', (): void => {
  it.each([true, false])(
    'sets only the authenticated user mode to %s in a transaction',
    async (enabled: boolean): Promise<void> => {
      const setEnabled = vi.fn().mockResolvedValue(undefined);
      const tx: TransactionContext = { executeNative: vi.fn() };
      const recordOptions = vi.fn();
      const runInTransaction = async <T>(
        work: (context: TransactionContext) => Promise<T>,
        options: { userId: string; tenantId?: string },
      ): Promise<T> => {
        recordOptions(options);
        return work(tx);
      };
      const useCase = new SetBuyerWholesaleUseCase(
        { setEnabled, isEligible: vi.fn() },
        { runInTransaction },
      );
      await useCase.execute({ userId: 'buyer', enabled });
      expect(recordOptions).toHaveBeenCalledWith({ userId: 'buyer' });
      expect(setEnabled).toHaveBeenCalledWith('buyer', enabled, tx);
    },
  );
});
