import { describe, expect, it, vi } from 'vitest';
import { ShipmentCompletionException, type ClaimedJob } from '@canaldigital/packages/core';
import { runShipmentCreationLoop } from '@/worker/shipment-creation-loop';

const job = (orderId: string): ClaimedJob => ({
  tenantId: 't',
  orderId,
  leaseToken: 'l',
  leaseSeconds: 180,
  attempts: 1,
  claimedFrom: 'queued',
});

class RawDriverError extends Error {
  public constructor() {
    super('password=hunter2 label-bytes');
    this.name = 'ShipmentJobRepositoryException';
  }
}

describe('runShipmentCreationLoop', (): void => {
  it('drains jobs, sleeps when idle, and stops gracefully', async (): Promise<void> => {
    const controller = new AbortController();
    const queue: (ClaimedJob | null)[] = [job('a'), job('b'), null];
    const executed: string[] = [];
    const sleep = vi.fn(async (): Promise<void> => {
      controller.abort();
    });
    const setReady = vi.fn();
    await runShipmentCreationLoop({
      claim: async (): Promise<ClaimedJob | null> => queue.shift() ?? null,
      execute: async (j): Promise<void> => {
        executed.push(j.orderId);
      },
      sleep,
      signal: controller.signal,
      setReady,
      log: (): void => {},
      markedCreating: (): boolean => false,
      quarantine: async (): Promise<void> => {},
    });
    expect(executed).toEqual(['a', 'b']);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(setReady).toHaveBeenLastCalledWith(false);
    expect(setReady).toHaveBeenCalledWith(true);
  });

  it('finishes the current job before exiting on abort', async (): Promise<void> => {
    const controller = new AbortController();
    const executed: string[] = [];
    await runShipmentCreationLoop({
      claim: async (): Promise<ClaimedJob | null> => job('a'),
      execute: async (j): Promise<void> => {
        controller.abort();
        await Promise.resolve();
        executed.push(j.orderId);
      },
      sleep: async (): Promise<void> => {},
      signal: controller.signal,
      setReady: (): void => {},
      log: (): void => {},
      markedCreating: (): boolean => false,
      quarantine: async (): Promise<void> => {},
    });
    expect(executed).toEqual(['a']);
  });

  it('does not claim anything when already aborted', async (): Promise<void> => {
    const controller = new AbortController();
    controller.abort();
    const claim = vi.fn(async (): Promise<ClaimedJob | null> => null);
    await runShipmentCreationLoop({
      claim,
      execute: async (): Promise<void> => {},
      sleep: async (): Promise<void> => {},
      signal: controller.signal,
      setReady: (): void => {},
      log: (): void => {},
      markedCreating: (): boolean => false,
      quarantine: async (): Promise<void> => {},
    });
    expect(claim).not.toHaveBeenCalled();
  });

  const base = (
    overrides: Partial<Parameters<typeof runShipmentCreationLoop>[0]>,
  ): Parameters<typeof runShipmentCreationLoop>[0] => ({
    claim: async (): Promise<ClaimedJob | null> => null,
    execute: async (): Promise<void> => {},
    sleep: async (): Promise<void> => {},
    signal: new AbortController().signal,
    setReady: (): void => {},
    log: (): void => {},
    markedCreating: (): boolean => false,
    quarantine: async (): Promise<void> => {},
    ...overrides,
  });

  it('quarantines a job that failed before creating and continues with the next', async (): Promise<void> => {
    const controller = new AbortController();
    const queue: (ClaimedJob | null)[] = [job('bad'), job('good'), null];
    const executed: string[] = [];
    const quarantined: [string, string][] = [];
    const logs: string[] = [];
    const setReady = vi.fn();
    await runShipmentCreationLoop(
      base({
        claim: async (): Promise<ClaimedJob | null> => queue.shift() ?? null,
        execute: async (j): Promise<void> => {
          if (j.orderId === 'bad') throw new RawDriverError();
          executed.push(j.orderId);
        },
        sleep: async (): Promise<void> => {
          controller.abort();
        },
        signal: controller.signal,
        setReady,
        log: (line): void => {
          logs.push(line);
        },
        quarantine: async (j, reason): Promise<void> => {
          quarantined.push([j.orderId, reason]);
        },
      }),
    );
    expect(quarantined).toEqual([['bad', 'INTERNAL_ERROR']]);
    expect(executed).toEqual(['good']);
    expect(setReady.mock.calls).toEqual([[true], [false]]);
    const output = logs.join(String.fromCharCode(10));
    expect(output).toContain('ShipmentJobRepositoryException');
    expect(output).toContain('bad');
    expect(output).not.toContain('hunter2');
    expect(output).not.toContain('label-bytes');
  });

  it('quarantines as ambiguous when the job was already marked creating', async (): Promise<void> => {
    const controller = new AbortController();
    const quarantined: [string, string][] = [];
    const queue: (ClaimedJob | null)[] = [job('late')];
    await runShipmentCreationLoop(
      base({
        claim: async (): Promise<ClaimedJob | null> => queue.shift() ?? null,
        execute: async (): Promise<void> => {
          throw new RawDriverError();
        },
        sleep: async (): Promise<void> => {
          controller.abort();
        },
        signal: controller.signal,
        markedCreating: (): boolean => true,
        quarantine: async (j, reason): Promise<void> => {
          quarantined.push([j.orderId, reason]);
        },
      }),
    );
    expect(quarantined).toEqual([['late', 'AMBIGUOUS_RESULT']]);
  });

  it('quarantines a re-claimed creating job as ambiguous and continues', async (): Promise<void> => {
    const controller = new AbortController();
    const reclaimed: ClaimedJob = { ...job('crashed'), claimedFrom: 'creating' };
    const queue: (ClaimedJob | null)[] = [reclaimed, job('next'), null];
    const quarantined: [string, string][] = [];
    const executed: string[] = [];
    await runShipmentCreationLoop(
      base({
        claim: async (): Promise<ClaimedJob | null> => queue.shift() ?? null,
        execute: async (j): Promise<void> => {
          if (j.orderId === 'crashed') throw new RawDriverError();
          executed.push(j.orderId);
        },
        sleep: async (): Promise<void> => {
          controller.abort();
        },
        signal: controller.signal,
        markedCreating: (): boolean => false,
        quarantine: async (j, reason): Promise<void> => {
          quarantined.push([j.orderId, reason]);
        },
      }),
    );
    expect(quarantined).toEqual([['crashed', 'AMBIGUOUS_RESULT']]);
    expect(executed).toEqual(['next']);
  });

  it('logs the carrier tracking number of a completion failure before quarantining', async (): Promise<void> => {
    const logs: string[] = [];
    const failure = runShipmentCreationLoop(
      base({
        claim: async (): Promise<ClaimedJob | null> => job('order-9'),
        execute: async (): Promise<void> => {
          throw new ShipmentCompletionException('794600000001');
        },
        markedCreating: (): boolean => true,
        // Even when the quarantine write fails, the number must already be in the log.
        quarantine: async (): Promise<void> => {
          throw new RawDriverError();
        },
        log: (line): void => {
          logs.push(line);
        },
      }),
    );
    await expect(failure).rejects.toThrow('Shipment creation worker loop failed');
    expect(logs).toContain(
      'shipment_creation_provider_tracking order=order-9 tracking=794600000001',
    );
    expect(logs.join(String.fromCharCode(10))).not.toContain('hunter2');
  });

  it('never prints control characters from a carrier tracking number', async (): Promise<void> => {
    const controller = new AbortController();
    const logs: string[] = [];
    const queue: (ClaimedJob | null)[] = [job('order-7')];
    await runShipmentCreationLoop(
      base({
        claim: async (): Promise<ClaimedJob | null> => queue.shift() ?? null,
        execute: async (): Promise<void> => {
          throw new ShipmentCompletionException('7946' + String.fromCharCode(10) + 'fake=1');
        },
        sleep: async (): Promise<void> => {
          controller.abort();
        },
        signal: controller.signal,
        log: (line): void => {
          logs.push(line);
        },
      }),
    );
    expect(logs).toContain(
      'shipment_creation_provider_tracking order=order-7 tracking=7946_fake_1',
    );
  });

  it('does not log a tracking line for errors without a carrier number', async (): Promise<void> => {
    const controller = new AbortController();
    const logs: string[] = [];
    const queue: (ClaimedJob | null)[] = [job('order-8')];
    await runShipmentCreationLoop(
      base({
        claim: async (): Promise<ClaimedJob | null> => queue.shift() ?? null,
        execute: async (): Promise<void> => {
          throw new RawDriverError();
        },
        sleep: async (): Promise<void> => {
          controller.abort();
        },
        signal: controller.signal,
        log: (line): void => {
          logs.push(line);
        },
      }),
    );
    expect(logs.some((line): boolean => line.includes('provider_tracking'))).toBe(false);
  });

  it('marks unhealthy and rethrows generically when quarantine itself fails', async (): Promise<void> => {
    const logs: string[] = [];
    const setReady = vi.fn();
    const failure = runShipmentCreationLoop(
      base({
        claim: async (): Promise<ClaimedJob | null> => job('order-1'),
        execute: async (): Promise<void> => {
          throw new RawDriverError();
        },
        quarantine: async (): Promise<void> => {
          throw new RawDriverError();
        },
        setReady,
        log: (line): void => {
          logs.push(line);
        },
      }),
    );
    await expect(failure).rejects.toThrow('Shipment creation worker loop failed');
    await failure.catch((error: unknown): void => {
      expect(error instanceof Error && error.cause).toBeFalsy();
    });
    expect(setReady).toHaveBeenLastCalledWith(false);
    const output = logs.join(String.fromCharCode(10));
    expect(output).toContain('order-1');
    expect(output).not.toContain('hunter2');
  });

  it('marks unhealthy when claiming itself fails', async (): Promise<void> => {
    const setReady = vi.fn();
    await expect(
      runShipmentCreationLoop(
        base({
          claim: async (): Promise<ClaimedJob | null> => {
            throw new Error('boom');
          },
          setReady,
        }),
      ),
    ).rejects.toThrow('Shipment creation worker loop failed');
    expect(setReady).toHaveBeenLastCalledWith(false);
  });
});
