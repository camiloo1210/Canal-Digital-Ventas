import { createClient } from '@supabase/supabase-js';
import type { LabelStorageClient } from '@/shipment-creation/infrastructure/supabase-label-storage.adapter';

const STORAGE_TIMEOUT_MS = 60_000;

/** Bounds every request without discarding a signal the caller already supplied. */
export function withStorageTimeout(
  fetcher: typeof fetch,
  timeoutMs: number,
): (input: Parameters<typeof fetch>[0], init?: RequestInit) => Promise<Response> {
  return (input, init): Promise<Response> => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetcher(input, { ...init, signal });
  };
}

/** Service-role storage client for the worker; every request is bounded so a lease cannot stall. */
export function createLabelStorageClient(url: string, serviceRoleKey: string): LabelStorageClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: withStorageTimeout(fetch, STORAGE_TIMEOUT_MS) },
  }).storage;
}
