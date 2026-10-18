import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

export interface PaymentWorkerConfig {
  readonly databaseUrl: string;
  readonly pollIntervalMs: number;
}

export function loadPaymentWorkerConfig(
  env: Readonly<Record<string, string | undefined>>,
): PaymentWorkerConfig {
  const databaseUrl = env.PAYMENT_WORKER_DATABASE_URL ?? '';
  try {
    const url = new URL(databaseUrl);
    const username = decodeURIComponent(url.username).split('.')[0];
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !username ||
      ['postgres', 'service_role', 'authenticator', 'supabase_admin'].includes(username)
    ) {
      throw new PaymentRepositoryException('Invalid payment worker connection.');
    }
  } catch {
    throw new PaymentRepositoryException(
      'PAYMENT_WORKER_DATABASE_URL must use a restricted PostgreSQL LOGIN.',
    );
  }
  const pollIntervalMs = Number(env.PAYMENT_INBOX_POLL_INTERVAL_MS ?? '1000');
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 100 || pollIntervalMs > 60000) {
    throw new PaymentRepositoryException('Invalid PAYMENT_INBOX_POLL_INTERVAL_MS.');
  }
  return { databaseUrl, pollIntervalMs };
}
