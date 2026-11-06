import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { requireDashboardPermission } from '@/features/dashboard/queries/dashboard-context.query';
import { UserPermission } from '@canaldigital/packages/core';
import {
  parseIntelligenceQuery,
  todayIso,
  type IntelligenceSearchParams,
} from '@/features/dashboard/queries/business-intelligence-query';
import { intelligenceQueryKey } from '@/features/dashboard/utils/business-intelligence-range';
import { TenantScope } from '@/features/dashboard/components/tenant-scope';
import { tenantParam } from '@/features/dashboard/utils/tenant-scope';
import { BusinessIntelligenceFilters } from '@/features/dashboard/components/business-intelligence-filters';
import { BusinessIntelligenceResults } from '@/features/dashboard/components/business-intelligence-results';
import { BusinessIntelligenceSkeleton } from '@/features/dashboard/components/business-intelligence-skeleton';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('BusinessIntelligence');
  return { title: t('metadata') };
}

export default async function BusinessIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<IntelligenceSearchParams>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const { userId, tenantId } = await requireDashboardPermission(
    UserPermission.VIEW_REPORTS,
    tenantParam(params.tenant),
  );
  const query = parseIntelligenceQuery(params);
  const t = await getTranslations('BusinessIntelligence');
  return (
    <TenantScope tenantId={tenantId}>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
        <div className="space-y-6 px-4 py-6 lg:px-6 lg:py-8">
          <header className="space-y-3">
            <Badge variant="outline">{t('eyebrow')}</Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">{t('title')}</h1>
            <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
              {t('description')}
            </p>
          </header>
          <BusinessIntelligenceFilters query={query} maxDate={todayIso()} />
          <React.Suspense
            key={intelligenceQueryKey(query)}
            fallback={<BusinessIntelligenceSkeleton label={t('loading')} />}
          >
            <BusinessIntelligenceResults userId={userId} tenantId={tenantId} query={query} />
          </React.Suspense>
        </div>
      </div>
    </TenantScope>
  );
}
