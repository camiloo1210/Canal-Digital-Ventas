import { describe, expect, it, vi } from 'vitest';
import {
  CreateShipmentUseCase,
  ShipmentCompletionException,
} from '@/shipment-creation/application/use-cases/create-shipment.use-case';
import type { ClaimedJob } from '@/shipment-creation/application/ports/out/shipment-job-repository.port';
import type { ShipmentCreationSource } from '@/shipment-creation/application/ports/out/shipment-creation-source.port';
import { ShipmentProviderRejectedException } from '@/shipment-creation/application/exceptions/shipment-provider-rejected.exception';
import { ShipmentProviderAmbiguousException } from '@/shipment-creation/application/exceptions/shipment-provider-ambiguous.exception';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER = '22222222-2222-4222-8222-222222222222';
const SYSTEM = '00000000-0000-4000-8000-000000000051';
const job: ClaimedJob = {
  tenantId: TENANT,
  orderId: ORDER,
  leaseToken: '33333333-3333-4333-8333-333333333333',
  leaseSeconds: 120,
  attempts: 1,
  claimedFrom: 'queued',
};
const origin = {
  contactName: 'Store',
  phone: '300',
  street: 'Calle 1',
  city: 'Bogota',
  state: 'DC',
  zipCode: '110111',
  country: 'CO',
};
const source: ShipmentCreationSource = {
  orderStatus: 'processing',
  hasRecordedShipment: false,
  recipient: {
    name: 'Buyer',
    phone: '310',
    street: 'Cra 2',
    city: 'Medellin',
    state: 'ANT',
    zipCode: '050001',
    country: 'CO',
  },
  items: [
    { quantity: 2, packageData: { weightGrams: 500, lengthMm: 300, widthMm: 200, heightMm: 50 } },
  ],
};
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

interface Fixture {
  useCase: CreateShipmentUseCase;
  calls: string[];
  jobs: {
    claimNext: ReturnType<typeof vi.fn>;
    markCreating: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    markNeedsAttention: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>;
    recordProviderTrackingNumber: ReturnType<typeof vi.fn>;
  };
  load: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  record: ReturnType<typeof vi.fn>;
  enable: ReturnType<typeof vi.fn>;
  runInTransaction: ReturnType<typeof vi.fn>;
}

function setup(overrides: { credentialRef?: string | null } = {}): Fixture {
  const calls: string[] = [];
  const track =
    <T>(name: string, value: T): (() => Promise<T>) =>
    async (): Promise<T> => {
      calls.push(name);
      return value;
    };
  const jobs = {
    claimNext: vi.fn(),
    markCreating: vi.fn().mockImplementation(track('markCreating', true)),
    complete: vi.fn().mockImplementation(track('complete', undefined)),
    markNeedsAttention: vi.fn().mockImplementation(track('markNeedsAttention', undefined)),
    markFailed: vi.fn().mockImplementation(track('markFailed', undefined)),
    retry: vi.fn(),
    recordProviderTrackingNumber: vi
      .fn()
      .mockImplementation(track('recordProviderTrackingNumber', undefined)),
  };
  const load = vi.fn().mockImplementation(track('load', source));
  const find = vi.fn().mockImplementation(track('origin', origin));
  const create = vi
    .fn()
    .mockImplementation(track('provider', { trackingNumber: '794600000001', labelPdf: PDF }));
  const put = vi.fn().mockImplementation(track('put', `${TENANT}/label.pdf`));
  const record = vi.fn().mockImplementation(track('record', undefined));
  const enable = vi.fn().mockImplementation(track('enable', undefined));
  const tx: TransactionContext = { executeNative: vi.fn() };
  const runInTransaction = vi
    .fn()
    .mockImplementation(
      async <T>(operation: (context: TransactionContext) => Promise<T>): Promise<T> => {
        calls.push('begin');
        const result = await operation(tx);
        calls.push('commit');
        return result;
      },
    );
  const transactions: TransactionManagerPort = {
    runInTransaction: runInTransaction as TransactionManagerPort['runInTransaction'],
  };
  const useCase = new CreateShipmentUseCase(
    jobs,
    { load },
    { find },
    { create },
    { put, signedUrl: vi.fn() },
    { record },
    { enable },
    transactions,
    {
      accountNumber: '740561073',
      serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
      systemActorId: SYSTEM,
      credentialRefForTenant: (): string | null =>
        overrides.credentialRef === undefined ? 'store' : overrides.credentialRef,
    },
  );
  return { useCase, calls, jobs, load, find, create, put, record, enable, runInTransaction };
}

describe('create shipment use case', (): void => {
  it('commits creating before the carrier call and completes atomically after it', async (): Promise<void> => {
    const f = setup();
    await f.useCase.execute(job);
    expect(f.calls).toEqual([
      'load',
      'origin',
      'markCreating',
      'provider',
      'recordProviderTrackingNumber',
      'put',
      'begin',
      'record',
      'enable',
      'complete',
      'commit',
    ]);
    expect(f.create).toHaveBeenCalledWith({
      credentialRef: 'store',
      origin,
      recipient: source.recipient,
      package: { weightGrams: 1000, lengthMm: 300, widthMm: 200, heightMm: 100 },
      accountNumber: '740561073',
      serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
    });
    expect(f.jobs.recordProviderTrackingNumber).toHaveBeenCalledWith(job, '794600000001');
    expect(f.put).toHaveBeenCalledWith(TENANT, PDF);
    expect(f.record).toHaveBeenCalledWith(
      {
        tenantId: TENANT,
        orderId: ORDER,
        carrier: 'FedEx',
        trackingNumber: '794600000001',
        actorId: SYSTEM,
      },
      expect.anything(),
    );
    expect(f.enable).toHaveBeenCalledWith(
      { tenantId: TENANT, orderId: ORDER, trackingNumber: '794600000001', provider: 'fedex' },
      expect.anything(),
    );
    expect(f.jobs.complete).toHaveBeenCalledWith(job, `${TENANT}/label.pdf`, expect.anything());
    expect(f.runInTransaction).toHaveBeenCalledWith(expect.any(Function), {
      userId: SYSTEM,
      tenantId: TENANT,
    });
  });

  it('needs attention for missing package data without calling the carrier', async (): Promise<void> => {
    const f = setup();
    f.load.mockResolvedValue({
      ...source,
      items: [...source.items, { quantity: 1, packageData: null }],
    });
    await f.useCase.execute(job);
    expect(f.jobs.markNeedsAttention).toHaveBeenCalledWith(job, 'MISSING_PACKAGE_DATA');
    expect(f.jobs.markCreating).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });

  it('never creates a carrier shipment when the order already has a recorded tracking number', async (): Promise<void> => {
    const f = setup();
    f.load.mockResolvedValue({
      ...source,
      // Even when other checks would also fail: a retry could never make progress.
      hasRecordedShipment: true,
      items: [{ quantity: 1, packageData: null }],
    });
    f.find.mockResolvedValue(null);
    await f.useCase.execute(job);
    expect(f.jobs.markNeedsAttention).toHaveBeenCalledTimes(1);
    expect(f.jobs.markNeedsAttention).toHaveBeenCalledWith(job, 'SHIPMENT_ALREADY_RECORDED');
    expect(f.jobs.markCreating).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
    expect(f.record).not.toHaveBeenCalled();
    expect(f.enable).not.toHaveBeenCalled();
  });

  it('needs attention for an order without items', async (): Promise<void> => {
    const f = setup();
    f.load.mockResolvedValue({ ...source, items: [] });
    await f.useCase.execute(job);
    expect(f.jobs.markNeedsAttention).toHaveBeenCalledWith(job, 'MISSING_PACKAGE_DATA');
    expect(f.create).not.toHaveBeenCalled();
  });

  it('needs attention for a missing origin without calling the carrier', async (): Promise<void> => {
    const f = setup();
    f.find.mockResolvedValue(null);
    await f.useCase.execute(job);
    expect(f.jobs.markNeedsAttention).toHaveBeenCalledWith(job, 'MISSING_ORIGIN');
    expect(f.create).not.toHaveBeenCalled();
  });

  it('needs attention when no carrier credential is configured for the store', async (): Promise<void> => {
    const f = setup({ credentialRef: null });
    await f.useCase.execute(job);
    expect(f.jobs.markNeedsAttention).toHaveBeenCalledWith(job, 'MISSING_CREDENTIALS');
    expect(f.create).not.toHaveBeenCalled();
  });

  it('fails an order that is no longer being prepared without calling the carrier', async (): Promise<void> => {
    const f = setup();
    f.load.mockResolvedValue({ ...source, orderStatus: 'cancelled' });
    await f.useCase.execute(job);
    expect(f.jobs.markFailed).toHaveBeenCalledWith(job, 'ORDER_NOT_PROCESSING');
    expect(f.create).not.toHaveBeenCalled();
  });

  it('marks a crashed creating job ambiguous without calling the carrier', async (): Promise<void> => {
    const f = setup();
    await f.useCase.execute({ ...job, claimedFrom: 'creating' });
    expect(f.jobs.markNeedsAttention).toHaveBeenCalledWith(
      { ...job, claimedFrom: 'creating' },
      'AMBIGUOUS_RESULT',
    );
    expect(f.load).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });

  it('stops without calling the carrier when the lease was lost', async (): Promise<void> => {
    const f = setup();
    f.jobs.markCreating.mockResolvedValue(false);
    await f.useCase.execute(job);
    expect(f.create).not.toHaveBeenCalled();
    expect(f.jobs.markNeedsAttention).not.toHaveBeenCalled();
  });

  it('needs attention as ambiguous when the carrier outcome is unknown', async (): Promise<void> => {
    const f = setup();
    f.create.mockRejectedValue(new ShipmentProviderAmbiguousException());
    await f.useCase.execute(job);
    expect(f.calls).toEqual(['load', 'origin', 'markCreating', 'markNeedsAttention']);
    expect(f.jobs.markNeedsAttention).toHaveBeenCalledWith(job, 'AMBIGUOUS_RESULT');
    expect(f.jobs.markFailed).not.toHaveBeenCalled();
  });

  it('treats an unexpected error after creating as ambiguous', async (): Promise<void> => {
    const f = setup();
    f.create.mockRejectedValue(new Error('socket hang up'));
    await f.useCase.execute(job);
    expect(f.jobs.markNeedsAttention).toHaveBeenCalledWith(job, 'AMBIGUOUS_RESULT');
  });

  it('fails with the sanitized code when the carrier definitely rejects', async (): Promise<void> => {
    const f = setup();
    f.create.mockRejectedValue(new ShipmentProviderRejectedException('SHIPMENT.INVALID'));
    await f.useCase.execute(job);
    expect(f.jobs.markFailed).toHaveBeenCalledWith(job, 'SHIPMENT.INVALID');
    expect(f.jobs.markNeedsAttention).not.toHaveBeenCalled();
  });

  it('completes without a label when storage fails, keeping tracking enabled', async (): Promise<void> => {
    const f = setup();
    f.put.mockRejectedValue(new Error('storage down'));
    await f.useCase.execute(job);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.record).toHaveBeenCalled();
    expect(f.enable).toHaveBeenCalledWith(
      { tenantId: TENANT, orderId: ORDER, trackingNumber: '794600000001', provider: 'fedex' },
      expect.anything(),
    );
    expect(f.jobs.complete).toHaveBeenCalledWith(job, null, expect.anything());
    expect(f.jobs.markNeedsAttention).not.toHaveBeenCalled();
    expect(f.jobs.markFailed).not.toHaveBeenCalled();
  });

  it('keeps the carrier tracking number on the job when the success transaction fails', async (): Promise<void> => {
    const f = setup();
    f.enable.mockRejectedValue(new Error('db down'));
    await expect(f.useCase.execute(job)).rejects.toBeInstanceOf(ShipmentCompletionException);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.jobs.markNeedsAttention).toHaveBeenCalledWith(job, 'AMBIGUOUS_RESULT', '794600000001');
  });

  it('records the number lease-independently even when every lease-bound write fails', async (): Promise<void> => {
    const f = setup();
    // Lease lost (another replica re-claimed the job): completion and the fenced mark both fail.
    f.jobs.complete.mockRejectedValue(new Error('Shipment job lease lost'));
    f.jobs.markNeedsAttention.mockRejectedValue(new Error('db down'));
    const error: unknown = await f.useCase.execute(job).catch((e: unknown): unknown => e);
    expect(error).toBeInstanceOf(ShipmentCompletionException);
    expect((error as ShipmentCompletionException).providerTrackingNumber).toBe('794600000001');
    expect(f.jobs.recordProviderTrackingNumber).toHaveBeenCalledWith(job, '794600000001');
    const recorded = f.jobs.recordProviderTrackingNumber.mock.invocationCallOrder[0] as number;
    expect(recorded).toBeLessThan(f.put.mock.invocationCallOrder[0] as number);
    expect(recorded).toBeLessThan(f.runInTransaction.mock.invocationCallOrder[0] as number);
  });

  it('never records a number when the carrier did not create the shipment', async (): Promise<void> => {
    const f = setup();
    f.create.mockRejectedValue(new ShipmentProviderAmbiguousException());
    await f.useCase.execute(job);
    expect(f.jobs.recordProviderTrackingNumber).not.toHaveBeenCalled();
  });

  it('does not abort the success path when recording the number fails', async (): Promise<void> => {
    const f = setup();
    f.jobs.recordProviderTrackingNumber.mockRejectedValue(new Error('db blip'));
    await f.useCase.execute(job);
    expect(f.record).toHaveBeenCalled();
    expect(f.jobs.complete).toHaveBeenCalledWith(job, `${TENANT}/label.pdf`, expect.anything());
    expect(f.jobs.markNeedsAttention).not.toHaveBeenCalled();
  });

  it('normalizes free-text recipient and origin countries before calling the carrier', async (): Promise<void> => {
    const f = setup();
    f.load.mockResolvedValue({
      ...source,
      recipient: { ...source.recipient, country: 'Colombia' },
    });
    f.find.mockResolvedValue({ ...origin, country: 'colombia ' });
    await f.useCase.execute(job);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: { ...source.recipient, country: 'CO' },
        origin: { ...origin, country: 'CO' },
      }),
    );
  });

  it('fails an unmapped recipient country without calling the carrier', async (): Promise<void> => {
    const f = setup();
    f.load.mockResolvedValue({
      ...source,
      recipient: { ...source.recipient, country: 'Atlantis' },
    });
    await f.useCase.execute(job);
    expect(f.jobs.markFailed).toHaveBeenCalledWith(job, 'INVALID_RECIPIENT_COUNTRY');
    expect(f.jobs.markCreating).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });

  it('fails an unmapped origin country without calling the carrier', async (): Promise<void> => {
    const f = setup();
    f.find.mockResolvedValue({ ...origin, country: 'Atlantis' });
    await f.useCase.execute(job);
    expect(f.jobs.markFailed).toHaveBeenCalledWith(job, 'INVALID_ORIGIN_COUNTRY');
    expect(f.jobs.markCreating).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });

  it('still rethrows the typed error when marking ambiguous also fails', async (): Promise<void> => {
    const f = setup();
    f.record.mockRejectedValue(new Error('db down'));
    f.jobs.markNeedsAttention.mockRejectedValue(new Error('db still down'));
    await expect(f.useCase.execute(job)).rejects.toBeInstanceOf(ShipmentCompletionException);
  });
});
