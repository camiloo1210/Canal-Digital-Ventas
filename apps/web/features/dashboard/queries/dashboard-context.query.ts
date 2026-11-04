import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembershipsQuery } from '@/features/iam/queries/active-tenant.query';
import { readActiveTenantCookie } from '@/features/iam/utils/active-tenant-cookie';
import {
  createTenantId,
  type ActiveMembershipSummary,
  type MemberPermissionsReadModel,
  type TenantId,
  type UserPermission,
} from '@canaldigital/packages/core';
import { getMemberPermissionsQuery } from '@/features/users/queries/member-permissions.query';
import { isTenantId, withTenant } from '@/features/dashboard/utils/tenant-scope';

export const SELECT_BUSINESS_PATH = '/dashboard/select-business';

export interface DashboardIdentityContext {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  /** Every ACTIVE membership of the signed-in user. */
  memberships: ActiveMembershipSummary[];
}

export const getDashboardContextQuery = cache(async (): Promise<DashboardIdentityContext> => {
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
    memberships: await getActiveMembershipsQuery(user.id),
  };
});

/** Cookie default validated against the active memberships; null when absent or no longer valid. */
export async function defaultTenantFor(
  memberships: readonly ActiveMembershipSummary[],
): Promise<ActiveMembershipSummary | null> {
  if (memberships.length === 1) return memberships[0]!;
  const stored = await readActiveTenantCookie();
  if (!isTenantId(stored)) return null;
  return memberships.find((membership): boolean => membership.tenantId === stored) ?? null;
}

/**
 * Business a dashboard page renders: the validated explicit `?tenant=` id, else the single
 * membership, else the validated cookie default, else the selector page. The id is only accepted
 * when it is one of the user's ACTIVE memberships (read from the database on every request).
 */
export async function requireDashboardTenantSummary(requestedTenantId?: string | null): Promise<{
  context: DashboardIdentityContext;
  tenant: ActiveMembershipSummary;
}> {
  const context = await getDashboardContextQuery();
  if (context.memberships.length === 0) redirect('/onboarding');
  if (requestedTenantId) {
    const requested = isTenantId(requestedTenantId)
      ? context.memberships.find((membership): boolean => membership.tenantId === requestedTenantId)
      : undefined;
    if (!requested) redirect(SELECT_BUSINESS_PATH);
    return { context, tenant: requested };
  }
  const fallback = await defaultTenantFor(context.memberships);
  if (!fallback) redirect(SELECT_BUSINESS_PATH);
  return { context, tenant: fallback };
}

export async function requireDashboardTenant(
  requestedTenantId?: string | null,
): Promise<{ userId: string; tenantId: TenantId }> {
  const { context, tenant } = await requireDashboardTenantSummary(requestedTenantId);
  return { userId: context.userId, tenantId: createTenantId(tenant.tenantId) };
}

export interface DashboardPermissionContext {
  userId: string;
  tenantId: TenantId;
  member: MemberPermissionsReadModel;
}

/** Effective permissions of the signed-in member, or a redirect when they are not an active member. */
export async function requireDashboardMember(
  requestedTenantId?: string | null,
): Promise<DashboardPermissionContext> {
  const { userId, tenantId } = await requireDashboardTenant(requestedTenantId);
  const member = await getMemberPermissionsQuery(userId, tenantId);
  if (!member) redirect('/dashboard');
  return { userId, tenantId, member };
}

/**
 * Page guard: owners always pass; other members need at least one of the given permissions.
 * Denied members return to the overview of the SAME business with a notice.
 */
export async function requireDashboardPermission(
  required: UserPermission | readonly UserPermission[],
  requestedTenantId?: string | null,
): Promise<DashboardPermissionContext> {
  const context = await requireDashboardMember(requestedTenantId);
  const list: readonly UserPermission[] = Array.isArray(required)
    ? (required as readonly UserPermission[])
    : [required as UserPermission];
  const allowed =
    context.member.baseRole === 'OWNER' ||
    list.some((permission): boolean => context.member.permissions.includes(permission));
  if (!allowed) {
    const { memberships } = await getDashboardContextQuery();
    redirect(withTenant('/dashboard?denied=1', memberships.length > 1 ? context.tenantId : null));
  }
  return context;
}

/** Page guard for areas that are never delegated: only the OWNER passes. */
export async function requireDashboardOwner(
  requestedTenantId?: string | null,
): Promise<DashboardPermissionContext> {
  const context = await requireDashboardMember(requestedTenantId);
  if (context.member.baseRole !== 'OWNER') {
    const { memberships } = await getDashboardContextQuery();
    redirect(withTenant('/dashboard?denied=1', memberships.length > 1 ? context.tenantId : null));
  }
  return context;
}
