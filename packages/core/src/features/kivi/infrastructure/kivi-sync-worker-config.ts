import { MessagingException } from '@/shared/application/exceptions/messaging.exception';
import { loadKiviTokenCipher } from '@/kivi/infrastructure/aes-gcm-kivi-token.cipher';

export interface KiviSyncWorkerConfig {
  databaseUrl: string;
  pollIntervalMs: number;
  reconcileIntervalMs: number;
  retryIntervalMs: number;
  allowLocalDevelopment: boolean;
}

function boundedInteger(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(env[name] ?? String(fallback));
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new MessagingException(`Invalid ${name}`);
  }
  return value;
}

export function loadKiviSyncWorkerConfig(
  env: Record<string, string | undefined>,
): KiviSyncWorkerConfig {
  const databaseUrl = env.KIVI_SYNC_DATABASE_URL ?? '';
  try {
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname)
      throw new MessagingException('Invalid KIVI_SYNC_DATABASE_URL');
  } catch {
    // Never include the supplied URL: it contains credentials.
    throw new MessagingException('Invalid KIVI_SYNC_DATABASE_URL');
  }
  // Fail closed at startup: paired tokens cannot be decrypted without the platform key.
  loadKiviTokenCipher(env);
  const allowLocalDevelopment = env.KIVI_ALLOW_LOCAL_DEVELOPMENT === 'true';
  if (allowLocalDevelopment && env.NODE_ENV === 'production') {
    throw new MessagingException('KIVI_ALLOW_LOCAL_DEVELOPMENT is forbidden in production');
  }
  return {
    databaseUrl,
    pollIntervalMs: boundedInteger(env, 'KIVI_POLL_INTERVAL_MS', 1000, 1, 60_000),
    reconcileIntervalMs: boundedInteger(
      env,
      'KIVI_RECONCILE_INTERVAL_MS',
      6 * 3_600_000,
      60_000,
      7 * 24 * 3_600_000,
    ),
    retryIntervalMs: boundedInteger(env, 'KIVI_RETRY_INTERVAL_MS', 300_000, 1000, 24 * 3_600_000),
    allowLocalDevelopment,
  };
}
