import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  DEMOGRAPHIC_MIN_BUCKET_SIZE,
  DEMOGRAPHIC_MIN_TOTAL_SAMPLES,
} from '@canaldigital/packages/core';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireDashboardMember } from '@/features/dashboard/queries/dashboard-context.query';
import {
  getDemographicStatsReadRepository,
  isAdminAuthConfigured,
  getInvitationReadRepository,
  getMemberDirectoryReadRepository,
  getTenantRoleReadRepository,
} from '@/features/users/di/users.di';
import { TenantScope } from '@/features/dashboard/components/tenant-scope';
import {
  tenantParam,
  withTenant,
  type TenantSearchParams,
} from '@/features/dashboard/utils/tenant-scope';
import { RolesPanel } from '@/features/users/components/roles-panel';
import { InvitationsPanel } from '@/features/users/components/invitations-panel';
import { MembersPanel } from '@/features/users/components/members-panel';
import { DemographicsPanel } from '@/features/users/components/demographics-panel';

export async function UsersScreen({
  searchParams,
}: {
  searchParams: Promise<TenantSearchParams>;
}): Promise<React.JSX.Element> {
  const { userId, tenantId, member } = await requireDashboardMember(
    tenantParam((await searchParams).tenant),
  );
  // User management is reserved for the store owner, whatever a custom role grants.
  if (member.baseRole !== 'OWNER') redirect(withTenant('/dashboard?denied=1', tenantId));
  const [t, roles, invitations, members, stats] = await Promise.all([
    getTranslations('Users'),
    getTenantRoleReadRepository().listForOwner(userId, tenantId),
    getInvitationReadRepository().listForOwner(userId, tenantId),
    getMemberDirectoryReadRepository().listForOwner(userId, tenantId),
    getDemographicStatsReadRepository().findForOwner(userId, tenantId),
  ]);
  return (
    <TenantScope tenantId={tenantId}>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-6 lg:py-8">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-[1.75rem]">
              {t('title')}
            </h1>
            <p className="max-w-3xl max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground sm:text-[0.9375rem]">
              {t('subtitle')}
            </p>
          </header>
          <Tabs defaultValue="roles" className="min-w-0 gap-4">
            <TabsList
              className="h-auto min-h-12 max-w-full overflow-x-auto"
              aria-label={t('tabs.label')}
            >
              <TabsTrigger value="roles" className="min-h-11 px-4">
                {t('tabs.roles')}
              </TabsTrigger>
              <TabsTrigger value="members" className="min-h-11 px-4">
                {t('tabs.members')}
              </TabsTrigger>
              <TabsTrigger value="demographics" className="min-h-11 px-4">
                {t('tabs.demographics')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="roles" className="space-y-6">
              <RolesPanel roles={roles} />
              <InvitationsPanel
                roles={roles}
                invitations={invitations}
                adminAuthAvailable={isAdminAuthConfigured()}
              />
            </TabsContent>
            <TabsContent value="members">
              <MembersPanel
                members={members}
                roles={roles}
                adminAuthAvailable={isAdminAuthConfigured()}
              />
            </TabsContent>
            <TabsContent value="demographics">
              <DemographicsPanel
                stats={stats}
                minBucket={DEMOGRAPHIC_MIN_BUCKET_SIZE}
                minTotal={DEMOGRAPHIC_MIN_TOTAL_SAMPLES}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TenantScope>
  );
}
