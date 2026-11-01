import 'server-only';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { checkRequestRateLimit } from '@/lib/security/request-rate-limit';
import { reportSecurityDecision } from '@/lib/security/security-telemetry';

// Server Actions may be invoked at another page URL. Enforce auth attempts here too.
export async function authenticationLimitMessage(): Promise<string | null> {
  if (process.env.RATE_LIMIT_ENABLED !== 'true') return null;
  const decision = await checkRequestRateLimit(
    new Request('https://rate-limit.invalid/login', {
      method: 'POST',
      headers: await headers(),
    }),
    'auth-action',
  );
  if (!decision) return null;
  after((): Promise<void> => reportSecurityDecision(decision));
  const t = await getTranslations('Security');
  return t(decision.status === 429 ? 'rateLimited' : 'unavailable');
}
