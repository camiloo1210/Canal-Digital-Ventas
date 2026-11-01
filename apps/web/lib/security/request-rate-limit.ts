import 'server-only';

import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export type TrafficPolicy = 'read' | 'mutation' | 'auth' | 'auth-action' | 'webhook';
export type SecuritySignal = 'blocked' | 'unavailable';
export interface RateLimitDecision {
  status: 429 | 503;
  retryAfter: number;
  policy: TrafficPolicy;
  signal: SecuritySignal;
}
const limits: Record<TrafficPolicy, number> = {
  read: 300,
  mutation: 60,
  auth: 30,
  'auth-action': 10,
  webhook: 300,
};
let limiters: Record<TrafficPolicy, Ratelimit> | undefined;
let redis: Redis | undefined;
// Ten possible keys. Reporting optimization only, never the traffic counter.
const reportAfter = new Map<string, number>();
export function trafficPolicy(pathname: string, method: string): TrafficPolicy {
  if (pathname.replace(/\/$/, '') === '/api/webhooks/lemon-squeezy') return 'webhook';
  if (/^\/(login|signup|auth)(\/|$)/.test(pathname)) return 'auth';
  return ['GET', 'HEAD', 'OPTIONS'].includes(method) ? 'read' : 'mutation';
}
function rateLimitSubject(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const [head, tail] = new URL(`http://[${ip}]/`).hostname.slice(1, -1).split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const groups = [
    ...headGroups,
    ...Array<string>(Math.max(0, 8 - headGroups.length - tailGroups.length)).fill('0'),
    ...tailGroups,
  ];
  return `${groups
    .slice(0, 4)
    .map((group: string): string => group.padStart(4, '0'))
    .join(':')}::/64`;
}
function getLimiters(): Record<TrafficPolicy, Ratelimit> {
  if (limiters) return limiters;
  const connection = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    retry: false,
    signal: (): AbortSignal => AbortSignal.timeout(1000),
  });
  redis = connection;
  const prefix = `cdv:traffic:${process.env.VERCEL_ENV ?? 'development'}`;
  function limiter(policy: TrafficPolicy): Ratelimit {
    return new Ratelimit({
      redis: connection,
      limiter: Ratelimit.slidingWindow(limits[policy], '60 s'),
      prefix: `${prefix}:${policy}`,
      timeout: 1000,
      analytics: false,
    });
  }
  limiters = {
    read: limiter('read'),
    mutation: limiter('mutation'),
    auth: limiter('auth'),
    'auth-action': limiter('auth-action'),
    webhook: limiter('webhook'),
  };
  return limiters;
}
export async function checkRequestRateLimit(
  request: Request,
  explicitPolicy?: TrafficPolicy,
): Promise<RateLimitDecision | null> {
  if (process.env.RATE_LIMIT_ENABLED !== 'true' || process.env.VERCEL !== '1') return null;
  const policy = explicitPolicy ?? trafficPolicy(new URL(request.url).pathname, request.method);
  const unavailable: RateLimitDecision = {
    status: 503,
    retryAfter: 30,
    policy,
    signal: 'unavailable',
  };
  const outage = policy === 'read' || policy === 'webhook' ? null : unavailable;
  const ip = request.headers.get('x-vercel-forwarded-for')?.trim();
  const secret = process.env.RATE_LIMIT_KEY_SECRET;
  if (
    !ip ||
    isIP(ip) === 0 ||
    !secret ||
    secret.length < 32 ||
    !process.env.UPSTASH_REDIS_REST_URL?.startsWith('https://') ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  )
    return outage;
  try {
    const identifier = createHmac('sha256', secret).update(rateLimitSubject(ip)).digest('hex');
    const result = await getLimiters()[policy].limit(identifier);
    if (result.reason === 'timeout') return outage;
    if (result.success) return null;
    return {
      status: 429,
      retryAfter: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      policy,
      signal: 'blocked',
    };
  } catch {
    return outage;
  }
}
export async function claimSecurityReport(decision: RateLimitDecision): Promise<boolean> {
  const key = `${decision.policy}:${decision.signal}`;
  const now = Date.now();
  if ((reportAfter.get(key) ?? 0) > now) return false;
  reportAfter.set(key, now + 60_000);
  if (decision.signal === 'unavailable' || !redis) return true;
  try {
    return (
      (await redis.set(
        `cdv:traffic:${process.env.VERCEL_ENV ?? 'development'}:report:${key}`,
        '1',
        { nx: true, ex: 60 },
      )) === 'OK'
    );
  } catch {
    return false;
  }
}
