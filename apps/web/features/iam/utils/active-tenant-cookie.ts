import 'server-only';
import { cookies } from 'next/headers';

/**
 * Last business the user chose. It is only a navigation default: it is validated against the
 * user's ACTIVE memberships on every request and is never an authorization source.
 */
export const ACTIVE_TENANT_COOKIE = 'active_tenant';

export async function readActiveTenantCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
}

export async function writeActiveTenantCookie(tenantId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
