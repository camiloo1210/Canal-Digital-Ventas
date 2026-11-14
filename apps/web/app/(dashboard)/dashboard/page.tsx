import * as React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { requireDashboardTenantSummary } from '@/features/dashboard/queries/dashboard-context.query';
import { TenantScope } from '@/features/dashboard/components/tenant-scope';
import {
  parseIntelligencePeriod,
  todayIso,
  type IntelligenceSearchParams,
} from '@/features/dashboard/queries/business-intelligence-query';
import { intelligenceQueryKey } from '@/features/dashboard/utils/business-intelligence-range';
import { DashboardOverviewFilters } from '@/features/dashboard/components/dashboard-overview-filters';
import { tenantParam } from '@/features/dashboard/utils/tenant-scope';
import { getMemberPermissionsQuery } from '@/features/users/queries/member-permissions.query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DashboardOverviewResults,
  DashboardOverviewSkeleton,
} from '@/features/dashboard/components/dashboard-overview-results';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('AdminOverview');
  return { title: t('metadata') };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<IntelligenceSearchParams>;
}): Promise<React.JSX.Element | null> {
  const params = await searchParams;
  const { context, tenant } = await requireDashboardTenantSummary(tenantParam(params.tenant));
  const t = await getTranslations('AdminOverview');
  const period = parseIntelligencePeriod(params);
  const denied = params.denied !== undefined;
  const member = await getMemberPermissionsQuery(context.userId, tenant.tenantId);
  // The general overview (sales, orders) is its own permission, separate from the reports page.
  const canViewOverview =
    member?.baseRole === 'OWNER' || (member?.permissions.includes('VIEW_OVERVIEW') ?? false);
  return (
    <TenantScope tenantId={tenant.tenantId}>
      <div className="flex flex-1 flex-col">
        <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
        <div className="space-y-6 px-4 py-6 lg:px-6 lg:py-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-[1.75rem]">
                {t('title')}
              </h1>
              <p className="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground sm:text-[0.9375rem]">
                {t('description', { store: tenant.tenantName })}
              </p>
            </div>
            <Button
              nativeButton={false}
              role="link"
              variant="outline"
              className="min-h-11"
              render={<Link href={'/store/' + tenant.tenantSlug} />}
            >
              {t('viewStore')}
            </Button>
          </header>
          {denied && (
            <Alert role="alert">
              <AlertDescription>{t('denied')}</AlertDescription>
            </Alert>
          )}
          {canViewOverview ? (
            <>
              <DashboardOverviewFilters period={period} maxDate={todayIso()} />
              <React.Suspense
                key={intelligenceQueryKey(period)}
                fallback={<DashboardOverviewSkeleton label={t('loading')} />}
              >
                <DashboardOverviewResults
                  userId={context.userId}
                  tenantId={tenant.tenantId}
                  period={period}
                />
              </React.Suspense>
            </>
          ) : (
            <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
              {t('limitedAccess')}
            </p>
          )}
        </div>
      </div>
    </TenantScope>
  );
}
