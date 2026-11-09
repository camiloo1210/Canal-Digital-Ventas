import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { runFedexSandboxWorker } from '@/shipment-tracking/infrastructure/fedex-sandbox-worker';

const config = {
  databaseUrl: 'postgres://test/database',
  productionDatabaseUrl: 'postgres://prod/database',
  deploymentId: 'sandbox-id',
  nodeEnv: 'test',
  sandboxEnabled: true,
  appEnv: 'test',
  credentials: { ref: { clientId: 'id', clientSecret: 'secret' } },
  intervalMs: 1800000,
};
describe('FedEx worker safety', (): void => {
  it('does not contact FedEx when the database sandbox marker is absent', async (): Promise<void> => {
    const query = Object.assign(vi.fn().mockResolvedValue([]), {
      end: vi.fn().mockResolvedValue(undefined),
    });
    const fetcher = vi.fn();
    const connect = (): postgres.Sql<Record<string, unknown>> =>
      query as unknown as postgres.Sql<Record<string, unknown>>;
    await expect(
      runFedexSandboxWorker(config, new AbortController().signal, connect, fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    expect(query.end).toHaveBeenCalledOnce();
  });
  it('does not connect to the database when sandbox is not explicitly enabled', async (): Promise<void> => {
    const connect = vi.fn();
    const fetcher = vi.fn();
    await expect(
      runFedexSandboxWorker(
        { ...config, sandboxEnabled: false },
        new AbortController().signal,
        connect,
        fetcher,
      ),
    ).rejects.toThrow();
    expect(connect).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
