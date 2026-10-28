import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import type { BusinessIntelligenceReport, IntelligenceQuery } from '@canaldigital/packages/core';
import { getBusinessIntelligenceReadRepository } from '@/features/dashboard/di/dashboard.di';
import { BusinessIntelligenceDashboard } from '@/features/dashboard/components/business-intelligence-dashboard';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export async function BusinessIntelligenceResults({
  userId,
  tenantId,
  query,
}: {
  userId: string;
  tenantId: string;
  query: IntelligenceQuery;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('BusinessIntelligence');
  let report: BusinessIntelligenceReport | null = null;
  let failed = false;
  try {
    report = await getBusinessIntelligenceReadRepository().findForManager(userId, tenantId, query);
  } catch (error: unknown) {
    console.error('[BusinessIntelligence]', error);
    failed = true;
  }
  if (!report)
    return (
      <Alert role="alert">
        <AlertTitle>{t(failed ? 'errorTitle' : 'accessTitle')}</AlertTitle>
        <AlertDescription>
          <p>{t(failed ? 'errorHelp' : 'accessHelp')}</p>
          {failed && (
            <form action="/dashboard/business-intelligence" method="get">
              <input type="hidden" name="days" value={query.days} />
              <input type="hidden" name="leadTimeDays" value={query.leadTimeDays} />
              <input type="hidden" name="targetCoverageDays" value={query.targetCoverageDays} />
              <Button type="submit" variant="outline" className="mt-3 min-h-11">
                {t('retry')}
              </Button>
            </form>
          )}
        </AlertDescription>
      </Alert>
    );
  return <BusinessIntelligenceDashboard report={report} />;
}
