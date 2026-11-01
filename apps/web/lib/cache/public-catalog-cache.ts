import 'server-only';

import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

let redis: Redis | null | undefined;
const MISSING_VALUE_TTL_SECONDS = 5;
const VERSION_TTL_SECONDS = 86_400;
const inFlight = new Map<string, Promise<unknown>>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url?.startsWith('https://') || !token) {
    redis = null;
    return redis;
  }
  redis = new Redis({
    url,
    token,
    automaticDeserialization: false,
    retry: false,
    signal: (): AbortSignal => AbortSignal.timeout(1000),
  });
  return redis;
}

function namespace(): string {
  return `cdv:catalog:${process.env.VERCEL_ENV ?? 'development'}`;
}

function versionKey(tenantSlug: string): string {
  return `${namespace()}:version:${createHash('sha256').update(tenantSlug).digest('hex')}`;
}

async function tenantVersion(client: Redis, tenantSlug: string): Promise<string | null> {
  try {
    return (await client.get<string>(versionKey(tenantSlug))) ?? '0';
  } catch {
    return null;
  }
}

export async function invalidatePublicCatalog(tenantSlug: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    const key = versionKey(tenantSlug);
    await client.incr(key);
    await client.expire(key, VERSION_TTL_SECONDS);
  } catch {
    // Staleness stays bounded by the entry TTL when invalidation cannot reach Redis.
  }
}

export async function rememberPublicCatalogValue<T>(
  tenantSlug: string,
  segments: readonly string[],
  load: () => Promise<T>,
): Promise<T> {
  const client = getRedis();
  if (!client) return load();

  const version = await tenantVersion(client, tenantSlug);
  if (version === null) return load();

  const digest = createHash('sha256')
    .update(JSON.stringify([tenantSlug, version, segments]))
    .digest('hex');
  const key = `${namespace()}:v2:${digest}`;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const result = readThrough(client, key, load).finally((): void => {
    inFlight.delete(key);
  });
  inFlight.set(key, result);
  return result;
}

async function readThrough<T>(client: Redis, key: string, load: () => Promise<T>): Promise<T> {
  try {
    const cached = await client.get<string>(key);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch {
    // Redis is an optimization. A cache outage falls back to the public read port.
  }

  const value = await load();
  try {
    const parsedTtl = Number(process.env.CATALOG_CACHE_TTL_SECONDS);
    const positiveTtl =
      Number.isInteger(parsedTtl) && parsedTtl >= 5 && parsedTtl <= 300 ? parsedTtl : 15;
    const ttl = value === null ? Math.min(positiveTtl, MISSING_VALUE_TTL_SECONDS) : positiveTtl;
    const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(ttl / 5)));
    await client.set(key, JSON.stringify(value), { ex: ttl + jitter });
  } catch {
    // The source of truth is still returned when Redis cannot store the cache entry.
  }
  return value;
}
