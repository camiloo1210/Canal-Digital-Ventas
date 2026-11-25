import { describe, expect, it, vi } from 'vitest';
import { GetLabelUrlUseCase } from '@/shipment-creation/application/use-cases/get-label-url.use-case';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { ShipmentLabelUnavailableException } from '@/shipment-creation/application/exceptions/shipment-label-unavailable.exception';
import type { ShipmentLabelRecord } from '@/shipment-creation/application/ports/out/shipment-label-read.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

const tenantId = crypto.randomUUID();
const orderId = crypto.randomUUID();
const actor = crypto.randomUUID();
const path = `${tenantId}/${crypto.randomUUID()}.pdf`;
const dto = { orderId, tenantId, authenticatedSellerId: actor };

function fixture(record: ShipmentLabelRecord | null): {
  useCase: GetLabelUrlUseCase;
  access: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  signedUrl: ReturnType<typeof vi.fn>;
  tx: TransactionContext;
} {
  const tx: TransactionContext = { executeNative: vi.fn() };
  const access = vi.fn().mockResolvedValue(undefined);
  const find = vi.fn().mockResolvedValue(record);
  const signedUrl = vi.fn().mockResolvedValue('https://signed.example/label');
  const transactions: TransactionManagerPort = {
    runInTransaction: async <T>(op: (c: TransactionContext) => Promise<T>): Promise<T> => op(tx),
  };
  return {
    tx,
    access,
    find,
    signedUrl,
    useCase: new GetLabelUrlUseCase(
      { assertCanManage: access },
      { find },
      { put: vi.fn(), signedUrl },
      transactions,
    ),
  };
}

describe('GetLabelUrlUseCase', (): void => {
  it('returns a 60 second signed url for a done job with a label', async (): Promise<void> => {
    const f = fixture({ state: 'done', labelPath: path });
    await expect(f.useCase.execute(dto)).resolves.toBe('https://signed.example/label');
    expect(f.access).toHaveBeenCalledWith(actor, tenantId, orderId, f.tx);
    expect(f.find).toHaveBeenCalledWith(tenantId, orderId, f.tx);
    expect(f.signedUrl).toHaveBeenCalledWith(path, 60);
  });

  it('rejects another tenant seller before reading the job or signing', async (): Promise<void> => {
    const f = fixture({ state: 'done', labelPath: path });
    f.access.mockRejectedValue(new OrderNotFoundException());
    await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(OrderNotFoundException);
    expect(f.find).not.toHaveBeenCalled();
    expect(f.signedUrl).not.toHaveBeenCalled();
  });

  it.each([
    [null],
    [{ state: 'queued', labelPath: null }],
    [{ state: 'creating', labelPath: null }],
    [{ state: 'needs_attention', labelPath: path }],
    [{ state: 'failed', labelPath: path }],
    [{ state: 'done', labelPath: null }],
  ] as [ShipmentLabelRecord | null][])(
    'refuses when there is no done job with a label (%j)',
    async (record): Promise<void> => {
      const f = fixture(record);
      await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(
        ShipmentLabelUnavailableException,
      );
      expect(f.signedUrl).not.toHaveBeenCalled();
    },
  );
});
