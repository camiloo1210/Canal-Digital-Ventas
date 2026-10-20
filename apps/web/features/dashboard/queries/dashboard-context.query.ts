import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantContextQuery } from '@/features/iam/queries/active-tenant.query';
import { createTenantId, type TenantId } from '@canaldigital/packages/core';

export const getDashboardContextQuery = cache(
  async (): Promise<{
    userId: string;
    name: string;
    email: string;
    avatar: string;
    tenant: Awaited<ReturnType<typeof getActiveTenantContextQuery>>;
  }> => {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) redirect('/login');
    const metadata: Record<string, unknown> = user.user_metadata;
    return {
      userId: user.id,
      name:
        typeof metadata.full_name === 'string'
          ? metadata.full_name
          : (user.email?.split('@')[0] ?? ''),
      email: user.email ?? '',
      avatar: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : '',
      tenant: await getActiveTenantContextQuery(user.id),
    };
  },
);

export async function requireDashboardTenant(): Promise<{ userId: string; tenantId: TenantId }> {
  const context = await getDashboardContextQuery();
  if (context.tenant.status !== 'ready') {
    if (context.tenant.status === 'none') redirect('/onboarding');
    redirect('/dashboard');
  }
  return { userId: context.userId, tenantId: createTenantId(context.tenant.tenantId) };
}
