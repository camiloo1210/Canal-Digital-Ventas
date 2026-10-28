'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  Banknote,
  Boxes,
  ChartNoAxesCombined,
  PackageCheck,
  TrendingUp,
  ChevronDown,
  CircleHelp,
} from 'lucide-react';
import type { BusinessIntelligenceReport } from '@canaldigital/packages/core';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { BusinessIntelligenceChart } from '@/features/dashboard/components/business-intelligence-chart';
import { BusinessIntelligenceRanking } from '@/features/dashboard/components/business-intelligence-ranking';
import { BusinessIntelligenceProducts } from '@/features/dashboard/components/business-intelligence-products';
import {
  intelligenceMoney,
  intelligencePercent,
} from '@/features/dashboard/components/business-intelligence-format';

export function BusinessIntelligenceDashboard({
  report,
}: {
  report: BusinessIntelligenceReport;
}): React.JSX.Element {
  const t = useTranslations('BusinessIntelligence');
  const locale = useLocale();
  const money = (value: number): string => intelligenceMoney(value, report.currency, locale);
  const shortDate = (value: string): string =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(value),
    );
  const metrics = [
    {
      title: 'revenue',
      value: money(report.revenueCents),
      help:
        report.revenueChangeBps === null
          ? t('noComparison')
          : t('comparison', { percent: intelligencePercent(report.revenueChangeBps, locale) }),
      icon: Banknote,
    },
    {
      title: 'profit',
      value: money(report.estimatedProfitCents),
      help: t('profitHelp'),
      icon: TrendingUp,
    },
    {
      title: 'margin',
      value:
        report.marginBps === null
          ? t('unavailable')
          : intelligencePercent(report.marginBps, locale),
      help: t('marginHelp'),
      icon: ChartNoAxesCombined,
    },
    {
      title: 'restock',
      value: String(report.restockCount),
      help: t('restockHelp', { count: report.query.leadTimeDays }),
      icon: Boxes,
    },
  ] as const;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium">
          {t('appliedPeriod', {
            from: shortDate(report.daily[0].date),
            to: shortDate(report.daily[report.daily.length - 1].date),
          })}
        </p>
        <p className="text-xs text-muted-foreground">{t('completeDays')}</p>
      </div>
      <section aria-label={t('metrics')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric): React.JSX.Element => (
          <Card key={metric.title} className="gap-3 sm:[--card-spacing:--spacing(5)]">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardDescription className="text-sm leading-5">{t(metric.title)}</CardDescription>
              <metric.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className="break-words text-[1.65rem] leading-tight font-semibold tracking-tight tabular-nums">
                {metric.value}
              </p>
              <p
                className={`mt-3 text-xs leading-relaxed ${metric.title === 'revenue' && report.revenueChangeBps !== null ? (report.revenueChangeBps < 0 ? 'text-destructive' : 'text-success') : 'text-muted-foreground'}`}
              >
                {metric.help}
              </p>
              {metric.title === 'restock' && report.restockCount > 0 && (
                <a
                  href="#bi-priorities"
                  className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('viewPriorities')}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span>{t('ordersCount', { count: report.orderCount })}</span>
        <span>{t('unitsCount', { count: report.unitsSold })}</span>
        <span>{t('inventoryValue', { value: money(report.inventoryCostCents) })}</span>
      </div>
      {report.orderCount === 0 && (
        <Alert>
          <PackageCheck aria-hidden="true" />
          <AlertTitle>{t('noSalesTitle')}</AlertTitle>
          <AlertDescription>{t('noSalesHelp')}</AlertDescription>
        </Alert>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <BusinessIntelligenceChart report={report} />
        <BusinessIntelligenceRanking report={report} />
      </div>
      <Card id="bi-priorities" className="scroll-mt-20 sm:[--card-spacing:--spacing(5)]">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t('priorities')}</CardTitle>
            <Badge variant={report.restockCount > 0 ? 'destructive' : 'secondary'}>
              {t('priorityCount', { count: report.restockCount })}
            </Badge>
          </div>
          <CardDescription>{t('prioritiesHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          {report.priorities.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t('noPriorities')}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {report.priorities.slice(0, 6).map((product): React.JSX.Element => (
                <li key={product.id} className="flex flex-col rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 break-words font-medium">{product.name}</p>
                    <Badge variant="destructive">{t(`signals.${product.signal}`)}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {product.coverageDays === null
                      ? t('noDemand')
                      : t('coverageHelp', { count: product.coverageDays })}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {product.restockUnits > 0
                      ? t('buyUnits', { count: product.restockUnits })
                      : t('reviewDemand')}
                  </p>
                  <Link
                    href={`/dashboard/catalog/products/${product.id}/edit`}
                    className="mt-auto inline-flex min-h-11 items-center gap-1 pt-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {t('reviewProduct')}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {report.priorities.length > 6 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t('morePriorities', { count: report.priorities.length - 6 })}
            </p>
          )}
        </CardContent>
      </Card>
      <BusinessIntelligenceProducts
        key={`${report.query.days}-${report.query.leadTimeDays}-${report.query.targetCoverageDays}`}
        products={report.products}
        currency={report.currency}
      />
      <details className="group rounded-xl border bg-card px-4 sm:px-5">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-md py-4 font-medium focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <CircleHelp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{t('methodology')}</span>
          <ChevronDown
            className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t pb-5 pt-4">
          <p className="mb-3 text-sm text-muted-foreground">{t('methodologyHelp')}</p>
          <ul className="list-disc space-y-3 pl-4 text-sm leading-relaxed text-muted-foreground">
            {(
              [
                'revenueMethod',
                'costMethod',
                'restockMethod',
                'signalsMethod',
                'variantsMethod',
              ] as const
            ).map((key): React.JSX.Element => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      </details>
      <p className="text-xs text-muted-foreground">
        {t('updated', {
          date: new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'UTC',
          }).format(new Date(report.observedAt)),
        })}
      </p>
    </div>
  );
}
