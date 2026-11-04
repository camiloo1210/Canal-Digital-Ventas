import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DashboardShell } from '@/features/dashboard/components/dashboard-shell';
import {
  defaultTenantFor,
  getDashboardContextQuery,
} from '@/features/dashboard/queries/dashboard-context.query';
import { visibleDashboardNavigationKeys } from '@/features/dashboard/navigation/dashboard-navigation';
import { getMemberPermissionsQuery } from '@/features/users/queries/member-permissions.query';
import type { BusinessOption } from '@/features/dashboard/utils/current-business';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const context = await getDashboardContextQuery();
  const t = await getTranslations('AdminShell');
  if (context.memberships.length === 0) redirect('/onboarding');
  // A layout cannot read the page's ?tenant=, so it describes EVERY business of the user and the
  // client shell picks the displayed one (explicit param, else this validated default). Pages and
  // actions never rely on this: they re-validate their own explicit tenant on each request.
  const defaultTenant = await defaultTenantFor(context.memberships);
  const businesses = await Promise.all(
    context.memberships.map(async (membership): Promise<BusinessOption> => {
      const member = await getMemberPermissionsQuery(context.userId, membership.tenantId);
      return {
        tenantId: membership.tenantId,
        tenantName: membership.tenantName,
        tenantSlug: membership.tenantSlug,
        role: membership.role,
        visibleKeys: member
          ? visibleDashboardNavigationKeys(member.baseRole, member.permissions)
          : ['overview'],
      };
    }),
  );
  return (
    <div className="admin-space min-h-svh">
      <Link
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
      >
        {t('skip')}
      </Link>
      <DashboardShell
        user={{ name: context.name || t('account'), email: context.email, avatar: context.avatar }}
        businesses={businesses}
        defaultTenantId={defaultTenant?.tenantId ?? null}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
