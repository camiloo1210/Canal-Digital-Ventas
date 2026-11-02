import { MessagingException } from '@/shared/application/exceptions/messaging.exception';

export interface CartRetentionWorkerConfig {
  databaseUrl: string;
  /** Pause between sweeps once the backlog is drained. */
  intervalMs: number;
  /** Rows deleted per statement. */
  batchSize: number;
  /** Pause after a failed sweep. */
  retryMs: number;
}

export const CART_RETENTION_INTERVAL_MS = 15 * 60_000;
export const CART_RETENTION_BATCH_SIZE = 200;
export const CART_RETENTION_RETRY_MS = 60_000;

export function loadCartRetentionWorkerConfig(
  env: Record<string, string | undefined>,
): CartRetentionWorkerConfig {
  const databaseUrl = env.CART_RETENTION_DATABASE_URL ?? '';
  try {
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
      throw new MessagingException('Invalid CART_RETENTION_DATABASE_URL');
    }
  } catch {
    // Never echo the supplied value: it contains credentials.
    throw new MessagingException('Invalid CART_RETENTION_DATABASE_URL');
  }
  return {
    databaseUrl,
    intervalMs: CART_RETENTION_INTERVAL_MS,
    batchSize: CART_RETENTION_BATCH_SIZE,
    retryMs: CART_RETENTION_RETRY_MS,
  };
}
