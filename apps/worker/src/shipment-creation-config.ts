export interface ShipmentCreationConfig {
  readonly databaseUrl: string;
  readonly productionDatabaseUrl: string;
  readonly deploymentId: string;
  readonly nodeEnv: string;
  readonly credentials: Readonly<
    Record<string, { readonly clientId: string; readonly clientSecret: string }>
  >;
  readonly tenantRefs: Readonly<Record<string, string>>;
  readonly accountNumber: string;
  readonly serviceType: string;
  readonly systemActorId: string;
  readonly labelsSupabaseUrl: string;
  readonly labelsServiceRoleKey: string;
  readonly pollIntervalMs: number;
  readonly leaseSeconds: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^[A-Za-z0-9_-]{1,120}$/;
/**
 * Worst case of one job is about 140 s (OAuth 10 s + ship 30 s + 401 refresh 10 s + retried ship
 * 30 s + label upload 60 s + success transaction), so the lease must comfortably exceed it.
 */
const MIN_LEASE_SECONDS = 180;
const MAX_LEASE_SECONDS = 3600;

function plainObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}

function parseCredentials(
  json: string,
): Record<string, { clientId: string; clientSecret: string }> {
  const credentials: Record<string, { clientId: string; clientSecret: string }> = Object.create(
    null,
  ) as Record<string, { clientId: string; clientSecret: string }>;
  for (const [key, raw] of Object.entries(plainObject(JSON.parse(json)))) {
    const value = plainObject(raw);
    if (
      !REF.test(key) ||
      typeof value.clientId !== 'string' ||
      !value.clientId ||
      typeof value.clientSecret !== 'string' ||
      !value.clientSecret
    )
      throw new Error();
    credentials[key] = { clientId: value.clientId, clientSecret: value.clientSecret };
  }
  if (Object.keys(credentials).length === 0) throw new Error();
  return credentials;
}

function parseTenantRefs(
  json: string,
  credentials: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const refs: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [tenant, ref] of Object.entries(plainObject(JSON.parse(json)))) {
    if (!UUID.test(tenant) || typeof ref !== 'string' || !REF.test(ref) || !(ref in credentials))
      throw new Error();
    refs[tenant] = ref;
  }
  if (Object.keys(refs).length === 0) throw new Error();
  return refs;
}

function integer(raw: string | undefined, fallback: number): number {
  return raw ? Number(raw) : fallback;
}

/**
 * Returns null while the worker is switched off. When switched on, any problem raises one
 * generic error so no configuration value (URLs, keys, credentials) ever reaches a log.
 */
export function readShipmentCreationConfig(
  env: Readonly<Record<string, string | undefined>>,
): ShipmentCreationConfig | null {
  if (env.SHIPMENT_CREATION_SANDBOX_ENABLED !== 'true') return null;
  try {
    const databaseUrl = env.SHIPMENT_CREATION_DATABASE_URL;
    const deploymentId = env.TRACKING_DEPLOYMENT_ID;
    const accountNumber = env.FEDEX_SANDBOX_ACCOUNT_NUMBER;
    const serviceType = env.FEDEX_SERVICE_TYPE;
    const systemActorId = env.SHIPMENT_CREATION_SYSTEM_ACTOR_ID;
    const labelsSupabaseUrl = env.SHIPMENT_CREATION_LABELS_SUPABASE_URL;
    const labelsServiceRoleKey = env.SHIPMENT_CREATION_LABELS_SERVICE_ROLE_KEY;
    if (
      !databaseUrl ||
      !deploymentId ||
      !env.TRACKING_CREDENTIALS_JSON ||
      !accountNumber ||
      !serviceType ||
      !env.SHIPMENT_CREATION_TENANT_REFS_JSON ||
      !systemActorId ||
      !labelsSupabaseUrl ||
      !labelsServiceRoleKey
    )
      throw new Error();
    if (!UUID.test(deploymentId) || !UUID.test(systemActorId)) throw new Error();
    if (!/^https?:$/.test(new URL(labelsSupabaseUrl).protocol)) throw new Error();
    const credentials = parseCredentials(env.TRACKING_CREDENTIALS_JSON);
    const tenantRefs = parseTenantRefs(env.SHIPMENT_CREATION_TENANT_REFS_JSON, credentials);
    const pollIntervalMs = integer(env.SHIPMENT_CREATION_POLL_INTERVAL_MS, 5000);
    if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 1000) throw new Error();
    const leaseSeconds = integer(env.SHIPMENT_CREATION_LEASE_SECONDS, 180);
    if (
      !Number.isSafeInteger(leaseSeconds) ||
      leaseSeconds < MIN_LEASE_SECONDS ||
      leaseSeconds > MAX_LEASE_SECONDS
    )
      throw new Error();
    return {
      databaseUrl,
      productionDatabaseUrl: env.PRODUCTION_DATABASE_URL ?? '',
      deploymentId,
      nodeEnv: env.NODE_ENV ?? '',
      credentials,
      tenantRefs,
      accountNumber,
      serviceType,
      systemActorId,
      labelsSupabaseUrl,
      labelsServiceRoleKey,
      pollIntervalMs,
      leaseSeconds,
    };
  } catch {
    throw new Error('Invalid sandbox shipment creation worker configuration');
  }
}
