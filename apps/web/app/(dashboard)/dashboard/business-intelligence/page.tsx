import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { requireDashboardTenant } from '@/features/dashboard/queries/dashboard-context.query';
import {
  parseIntelligenceQuery,
  type IntelligenceSearchParams,
} from '@/features/dashboard/queries/business-intelligence-query';
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
  const { userId, tenantId } = await requireDashboardTenant();
  const query = parseIntelligenceQuery(await searchParams);
  const t = await getTranslations('BusinessIntelligence');
  return (
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
        <BusinessIntelligenceFilters query={query} />
        <React.Suspense
          key={`${query.days}-${query.leadTimeDays}-${query.targetCoverageDays}`}
          fallback={<BusinessIntelligenceSkeleton label={t('loading')} />}
        >
          <BusinessIntelligenceResults userId={userId} tenantId={tenantId} query={query} />
        </React.Suspense>
      </div>
    </div>
  );
}
