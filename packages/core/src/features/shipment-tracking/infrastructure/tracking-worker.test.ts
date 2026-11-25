import { describe, expect, it, vi } from 'vitest';
import { runTrackingLoop } from '@/shipment-tracking/infrastructure/tracking-worker';

describe('tracking worker loop', (): void => {
  it('processes one claim at a time and stops when cancelled', async (): Promise<void> => {
    const controller = new AbortController();
    const execute = vi.fn().mockImplementation(async (): Promise<'idle'> => {
      controller.abort();
      return 'idle';
    });
    const pause = vi.fn();
    await runTrackingLoop(
      { execute },
      controller.signal,
      pause,
      (): string => '2026-11-09T12:00:00.000Z',
      (): string => 'lease',
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });
  it('reports only aggregate result labels to the observer', async (): Promise<void> => {
    const controller = new AbortController();
    const execute = vi.fn().mockImplementation(async (): Promise<'applied'> => {
      controller.abort();
      return 'applied';
    });
    const observe = vi.fn();
    await runTrackingLoop(
      { execute },
      controller.signal,
      vi.fn(),
      (): string => '2026-11-09T12:00:00Z',
      (): string => 'lease',
      (): void => {},
      observe,
    );
    expect(observe).toHaveBeenCalledWith('applied');
  });
  it('runs maintenance before polling', async (): Promise<void> => {
    const controller = new AbortController();
    const order: string[] = [];
    const maintenance = vi.fn().mockImplementation(async (): Promise<void> => {
      order.push('maintenance');
    });
    const execute = vi.fn().mockImplementation(async (): Promise<'idle'> => {
      order.push('poll');
      controller.abort();
      return 'idle';
    });
    await runTrackingLoop(
      { execute },
      controller.signal,
      vi.fn(),
      (): string => '2026-11-09T12:00:00Z',
      (): string => 'lease',
      (): void => {},
      (): void => {},
      1000,
      maintenance,
    );
    expect(order).toEqual(['maintenance', 'poll']);
  });
  it('collects operational gauges before polling', async (): Promise<void> => {
    const controller = new AbortController();
    const collect = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn().mockImplementation(async (): Promise<'idle'> => {
      controller.abort();
      return 'idle';
    });
    await runTrackingLoop(
      { execute },
      controller.signal,
      vi.fn(),
      (): string => '2026-11-09T12:00:00Z',
      (): string => 'lease',
      (): void => {},
      (): void => {},
      1000,
      async (): Promise<void> => {},
      collect,
    );
    expect(collect).toHaveBeenCalledOnce();
  });
  it('waits after a transient provider error without exposing the error to logs', async (): Promise<void> => {
    const controller = new AbortController();
    const execute = vi.fn().mockRejectedValue(new Error('secret'));
    const pause = vi.fn().mockImplementation(async (): Promise<void> => {
      controller.abort();
    });
    await runTrackingLoop(
      { execute },
      controller.signal,
      pause,
      (): string => '2026-11-09T12:00:00.000Z',
      (): string => 'lease',
    );
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
