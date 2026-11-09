export interface TrackingWorkerConfig {
  readonly databaseUrl: string;
  readonly productionDatabaseUrl: string;
  readonly deploymentId: string;
  readonly nodeEnv: string;
  readonly sandboxEnabled: boolean;
  readonly appEnv: string;
  readonly credentials: Readonly<
    Record<string, { readonly clientId: string; readonly clientSecret: string }>
  >;
  readonly intervalMs: number;
  readonly minimumSpacingMs: number;
  readonly terminalIntervalMs: number;
  readonly retentionDays: number;
}
export function readTrackingWorkerConfig(
  env: Readonly<Record<string, string | undefined>>,
): TrackingWorkerConfig {
  try {
    if (
      env.TRACKING_SANDBOX_ENABLED !== 'true' ||
      env.APP_ENV !== 'test' ||
      !env.TRACKING_DATABASE_URL ||
      !env.TRACKING_DEPLOYMENT_ID ||
      !env.TRACKING_CREDENTIALS_JSON
    )
      throw new Error();
    const raw: unknown = JSON.parse(env.TRACKING_CREDENTIALS_JSON);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error();
    const credentials: Record<string, { clientId: string; clientSecret: string }> = Object.create(
      null,
    ) as Record<string, { clientId: string; clientSecret: string }>;
    for (const [key, value] of Object.entries(raw)) {
      if (
        !/^[A-Za-z0-9_-]{1,120}$/.test(key) ||
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value) ||
        !('clientId' in value) ||
        typeof value.clientId !== 'string' ||
        !value.clientId ||
        !('clientSecret' in value) ||
        typeof value.clientSecret !== 'string' ||
        !value.clientSecret
      )
        throw new Error();
      credentials[key] = { clientId: value.clientId, clientSecret: value.clientSecret };
    }
    if (Object.keys(credentials).length === 0) throw new Error();
    const intervalMs = env.TRACKING_INTERVAL_MS ? Number(env.TRACKING_INTERVAL_MS) : 1800000;
    if (!Number.isSafeInteger(intervalMs) || intervalMs < 60000) throw new Error();
    const minimumSpacingMs = env.TRACKING_MIN_SPACING_MS
      ? Number(env.TRACKING_MIN_SPACING_MS)
      : 1000;
    if (!Number.isSafeInteger(minimumSpacingMs) || minimumSpacingMs < 1000) throw new Error();
    const terminalIntervalMs = env.TRACKING_TERMINAL_INTERVAL_MS
      ? Number(env.TRACKING_TERMINAL_INTERVAL_MS)
      : 86400000;
    if (!Number.isSafeInteger(terminalIntervalMs) || terminalIntervalMs < intervalMs)
      throw new Error();
    const retentionDays = env.TRACKING_RETENTION_DAYS ? Number(env.TRACKING_RETENTION_DAYS) : 90;
    if (!Number.isSafeInteger(retentionDays) || retentionDays < 90 || retentionDays > 3650)
      throw new Error();
    return {
      databaseUrl: env.TRACKING_DATABASE_URL,
      productionDatabaseUrl: env.PRODUCTION_DATABASE_URL ?? '',
      deploymentId: env.TRACKING_DEPLOYMENT_ID,
      nodeEnv: env.NODE_ENV ?? '',
      sandboxEnabled: true,
      appEnv: env.APP_ENV,
      credentials,
      intervalMs,
      minimumSpacingMs,
      terminalIntervalMs,
      retentionDays,
    };
  } catch {
    throw new Error('Invalid sandbox tracking worker configuration');
  }
}
