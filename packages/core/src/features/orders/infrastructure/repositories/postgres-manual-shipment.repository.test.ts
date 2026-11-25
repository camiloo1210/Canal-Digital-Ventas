import { describe, expect, it, vi } from 'vitest';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { PostgresManualShipmentRepository } from '@/orders/infrastructure/repositories/postgres-manual-shipment.repository';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';

const input = {
  orderId: crypto.randomUUID(),
  tenantId: crypto.randomUUID(),
  actorId: crypto.randomUUID(),
  expectedVersion: 0,
  carrier: 'Carrier',
  trackingNumber: 'ABC',
};
function fixture(rows: object[]): {
  repository: PostgresManualShipmentRepository;
  sql: ReturnType<typeof vi.fn>;
  tx: TransactionContext;
} {
  const sql = vi.fn().mockResolvedValueOnce(rows).mockResolvedValueOnce([]);
  const tx: TransactionContext = {
    executeNative: async <TConnection, TResult>(
      callback: (connection: TConnection) => Promise<TResult>,
    ): Promise<TResult> => callback(sql as unknown as TConnection),
  };
  return { repository: new PostgresManualShipmentRepository(), sql, tx };
}
describe('manual shipment persistence', (): void => {
  it('writes shipment and audit within the supplied transaction', async (): Promise<void> => {
    const f = fixture([{ version: 1 }]);
    await f.repository.save(input, f.tx);
    expect(f.sql).toHaveBeenCalledTimes(2);
    expect((f.sql.mock.calls[1][0] as TemplateStringsArray).join('?')).toContain(
      'sales.manual_shipment_history',
    );
  });
  it('rejects stale writes without appending an audit entry', async (): Promise<void> => {
    const f = fixture([]);
    await expect(f.repository.save({ ...input, expectedVersion: 1 }, f.tx)).rejects.toThrow(
      OptimisticConcurrencyException,
    );
    expect(f.sql).toHaveBeenCalledTimes(1);
  });
});
