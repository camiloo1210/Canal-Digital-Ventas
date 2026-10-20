import * as React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { getDashboardContextQuery } from '@/features/dashboard/queries/dashboard-context.query';
import {
  DashboardOverviewResults,
  DashboardOverviewSkeleton,
} from '@/features/dashboard/components/dashboard-overview-results';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('AdminOverview');
  return { title: t('metadata') };
}

export default async function DashboardPage(): Promise<React.JSX.Element | null> {
  const context = await getDashboardContextQuery();
  if (context.tenant.status !== 'ready') return null;
  const t = await getTranslations('AdminOverview');
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
      <div className="space-y-6 px-4 py-6 lg:px-6 lg:py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">{t('title')}</h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              {t('description', { store: context.tenant.tenantName })}
            </p>
          </div>
          <Button
            nativeButton={false}
            role="link"
            variant="outline"
            className="min-h-11"
            render={<Link href={'/store/' + context.tenant.tenantSlug} />}
          >
            {t('viewStore')}
          </Button>
        </header>
        <React.Suspense fallback={<DashboardOverviewSkeleton label={t('loading')} />}>
          <DashboardOverviewResults userId={context.userId} tenantId={context.tenant.tenantId} />
        </React.Suspense>
      </div>
    </div>
  );
}
