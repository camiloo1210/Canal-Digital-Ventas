const BASE_MS = 1000;
const CAP_MS = 30_000;
const RETRY_AFTER_CAP_MS = 120_000;

/**
 * Exponential backoff with jitter in [base/2, base], never shorter than the server's Retry-After
 * (itself capped). `failures` is the number of consecutive failures (>= 1).
 */
export function computeBackoffMs(
  failures: number,
  retryAfterMs: number | null,
  random: () => number = Math.random,
): number {
  const exponent = Math.min(Math.max(failures, 1) - 1, 20);
  const base = Math.min(BASE_MS * 2 ** exponent, CAP_MS);
  const jittered = Math.round(base / 2 + (base / 2) * random());
  if (retryAfterMs === null) return jittered;
  return Math.max(jittered, Math.min(retryAfterMs, RETRY_AFTER_CAP_MS));
}
