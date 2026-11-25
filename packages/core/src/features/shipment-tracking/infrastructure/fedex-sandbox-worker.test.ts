import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import { runFedexSandboxWorker } from '@/shipment-tracking/infrastructure/fedex-sandbox-worker';

const config = {
  databaseUrl: 'postgres://test/database',
  productionDatabaseUrl: 'postgres://prod/database',
  deploymentId: 'sandbox-id',
  nodeEnv: 'test',
  sandboxEnabled: true,
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
  it('marks itself ready after a successful idle cycle and not ready on shutdown', async (): Promise<void> => {
    const controller = new AbortController();
    const query = Object.assign(
      vi
        .fn()
        .mockResolvedValueOnce([
          { environment: 'sandbox', deployment_id: config.deploymentId, authorized: true },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            active_count: 0,
            paused_count: 0,
            failed_count: 0,
            due_count: 0,
            oldest_age_seconds: null,
          },
        ])
        .mockImplementationOnce(async (): Promise<never[]> => {
          controller.abort();
          return [];
        }),
      { end: vi.fn().mockResolvedValue(undefined) },
    );
    const connect = (): postgres.Sql<Record<string, unknown>> =>
      query as unknown as postgres.Sql<Record<string, unknown>>;
    const setReady = vi.fn();
    await runFedexSandboxWorker(
      config,
      controller.signal,
      connect,
      vi.fn(),
      undefined,
      undefined,
      setReady,
    );
    expect(setReady.mock.calls).toEqual([[true], [false]]);
    expect(query.end).toHaveBeenCalledOnce();
  });
});
