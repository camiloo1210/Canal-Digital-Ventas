'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Clock } from 'lucide-react';
import type { OrderFlowReport } from '@canaldigital/packages/core';
import { TenantLink as Link } from '@/features/dashboard/components/tenant-scope';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function BusinessIntelligenceOrders({ flow }: { flow: OrderFlowReport }): React.JSX.Element {
  const t = useTranslations('BusinessIntelligence');
  const duration = (minutes: number): string => {
    if (minutes < 60) return t('durationMinutes', { count: minutes });
    if (minutes < 1440)
      return t('durationHours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
    return t('durationDays', {
      days: Math.floor(minutes / 1440),
      hours: Math.floor((minutes % 1440) / 60),
    });
  };
  const largest = Math.max(1, ...flow.statusCounts.map((row): number => row.count));
  return (
    <Card id="bi-orders" className="scroll-mt-20 sm:[--card-spacing:--spacing(5)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t('flowTitle')}</CardTitle>
          <Badge variant={flow.stuckCount > 0 ? 'destructive' : 'secondary'}>
            {t('stuckCount', { count: flow.stuckCount })}
          </Badge>
        </div>
        <CardDescription>{t('flowHelp', { count: flow.totalOrders })}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <section aria-label={t('flowStatusTitle')}>
          <h3 className="mb-3 text-sm font-medium">{t('flowStatusTitle')}</h3>
          {flow.totalOrders === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{t('flowEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {flow.statusCounts.map((row): React.JSX.Element => (
                <li
                  key={row.status}
                  className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm"
                >
                  <span className="truncate">{t(`flowStatus.${row.status}`)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(row.count / largest) * 100}%` }}
                    />
                  </span>
                  <span className="tabular-nums font-medium">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label={t('stagesTitle')}>
          <h3 className="mb-3 text-sm font-medium">{t('stagesTitle')}</h3>
          <ul className="space-y-2">
            {flow.stages.map((stage): React.JSX.Element => (
              <li
                key={`${stage.from}-${stage.to}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0">
                  {t(`flowStatus.${stage.from}`)}
                  <span aria-hidden="true"> / </span>
                  <span className="sr-only">{t('stageTo')}</span>
                  {t(`flowStatus.${stage.to}`)}
                </span>
                <span className="shrink-0 tabular-nums font-medium">
                  {stage.averageMinutes === null
                    ? t('noStageData')
                    : duration(stage.averageMinutes)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{t('stagesHelp')}</p>
        </section>
        <section aria-label={t('stuckTitle')} className="lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            {t('stuckTitle')}
          </h3>
          {flow.stuckOrders.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {t('noStuck', { hours: flow.stuckThresholdHours })}
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {flow.stuckOrders.map((order): React.JSX.Element => (
                <li key={order.id} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 break-words font-medium">{order.orderNumber}</p>
                    <Badge variant="destructive">{t(`flowStatus.${order.status}`)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('stuckFor', { hours: order.hoursInStatus })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {flow.stuckCount > flow.stuckOrders.length && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t('moreStuck', { count: flow.stuckCount - flow.stuckOrders.length })}
            </p>
          )}
          <Link
            href="/dashboard/orders"
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {t('viewOrders')}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      </CardContent>
    </Card>
  );
}
