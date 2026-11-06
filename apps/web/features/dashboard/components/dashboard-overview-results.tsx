import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import type {
  DashboardOverviewPeriod,
  DashboardOverviewReadModel,
} from '@canaldigital/packages/core';
import { getDashboardOverviewReadRepository } from '@/features/dashboard/di/dashboard.di';
import { TenantParamField } from '@/features/dashboard/components/tenant-scope';
import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { intelligenceRangeStart } from '@/features/dashboard/utils/business-intelligence-range';
import { Skeleton } from '@/components/ui/skeleton';

export async function DashboardOverviewResults({
  userId,
  tenantId,
  period,
}: {
  userId: string;
  tenantId: string;
  period: DashboardOverviewPeriod;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('AdminOverview');
  let overview: DashboardOverviewReadModel | null = null;
  let failed = false;
  try {
    overview = await getDashboardOverviewReadRepository().findForManager(userId, tenantId, period);
  } catch (error: unknown) {
    console.error('[DashboardOverview]', error);
    failed = true;
  }
  if (!overview)
    return (
      <Alert role="alert">
        <AlertTitle>{t(failed ? 'errorTitle' : 'accessTitle')}</AlertTitle>
        <AlertDescription>
          <p>{t(failed ? 'errorDescription' : 'accessDescription')}</p>
          {failed && (
            <form action="/dashboard" method="get">
              <TenantParamField />
              {period.endDate ? (
                <>
                  <input type="hidden" name="from" value={intelligenceRangeStart(period) ?? ''} />
                  <input type="hidden" name="to" value={period.endDate} />
                </>
              ) : (
                <input type="hidden" name="days" value={period.days} />
              )}
              <Button type="submit" variant="outline" className="mt-3 min-h-11">
                {t('retry')}
              </Button>
            </form>
          )}
        </AlertDescription>
      </Alert>
    );
  return <DashboardOverview overview={overview} />;
}

export function DashboardOverviewSkeleton({ label }: { label: string }): React.JSX.Element {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="space-y-6">
      <div aria-hidden="true" className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-xl motion-reduce:animate-none xl:col-span-2" />
        <Skeleton className="h-80 rounded-xl motion-reduce:animate-none" />
      </div>
      <Skeleton aria-hidden="true" className="h-80 rounded-xl motion-reduce:animate-none" />
    </div>
  );
}
