import { describe, expect, it } from 'vitest';
import { withStorageTimeout } from '@/shipment-creation/infrastructure/create-label-storage-client';

describe('withStorageTimeout', (): void => {
  it('keeps a caller abort signal alongside the timeout', async (): Promise<void> => {
    let received: AbortSignal | null | undefined;
    const wrapped = withStorageTimeout(async (_input, init): Promise<Response> => {
      received = init?.signal;
      return new Response(null);
    }, 60_000);
    const caller = new AbortController();
    await wrapped('https://x.test', { signal: caller.signal });
    expect(received?.aborted).toBe(false);
    caller.abort();
    expect(received?.aborted).toBe(true);
  });

  it('applies the timeout when no caller signal exists', async (): Promise<void> => {
    let received: AbortSignal | null | undefined;
    const wrapped = withStorageTimeout(async (_input, init): Promise<Response> => {
      received = init?.signal;
      return new Response(null);
    }, 1);
    await wrapped('https://x.test');
    await new Promise((resolve): void => {
      setTimeout(resolve, 20);
    });
    expect(received?.aborted).toBe(true);
  });
});
