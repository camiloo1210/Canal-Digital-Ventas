'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bar, Line, ComposedChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';
import type { BusinessIntelligenceReport } from '@canaldigital/packages/core';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { intelligenceMoney } from '@/features/dashboard/components/business-intelligence-format';
import { findIntelligenceDay } from '@/features/dashboard/components/business-intelligence-chart-data';

type Metric = 'revenue' | 'profit' | 'units';
const series = {
  revenue: ['revenueCents', 'previousRevenueCents'],
  profit: ['estimatedProfitCents', 'previousEstimatedProfitCents'],
  units: ['unitsSold', 'previousUnitsSold'],
} as const;

export function BusinessIntelligenceChart({
  report,
}: {
  report: BusinessIntelligenceReport;
}): React.JSX.Element {
  const t = useTranslations('BusinessIntelligence');
  const locale = useLocale();
  const [metric, setMetric] = React.useState<Metric>('revenue');
  const [current, previous] = series[metric];
  const date = (value: string): string =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(value),
    );
  const exact = (value: number): string =>
    metric === 'units'
      ? new Intl.NumberFormat(locale).format(value)
      : intelligenceMoney(value, report.currency, locale);
  const compact = (value: number): string =>
    new Intl.NumberFormat(
      locale,
      metric === 'units'
        ? { notation: 'compact' }
        : {
            style: 'currency',
            currency: report.currency,
            notation: 'compact',
            maximumFractionDigits: 1,
          },
    ).format(metric === 'units' ? value : value / 100);
  return (
    <Card className="min-w-0 gap-5 sm:[--card-spacing:--spacing(5)]">
      <CardHeader className="gap-3">
        <div>
          <CardTitle>{t('trend')}</CardTitle>
          <CardDescription className="mt-1.5">{t('trendHelp')}</CardDescription>
        </div>
        <div
          role="group"
          aria-label={t('chartMetric')}
          className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
        >
          {(['revenue', 'profit', 'units'] as const).map((value): React.JSX.Element => (
            <Button
              key={value}
              variant={metric === value ? 'outline' : 'ghost'}
              aria-pressed={metric === value}
              className="min-h-11 px-3 shadow-none"
              onClick={(): void => setMetric(value)}
            >
              {t(`chartMetrics.${value}`)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
          aria-label={t('legend')}
        >
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-3 rounded-sm bg-primary" aria-hidden="true" />
            {t('currentPeriod')}
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="w-5 border-t-2 border-dashed border-muted-foreground"
              aria-hidden="true"
            />
            {t('previousPeriod')}
          </span>
        </div>
        {report.orderCount === 0 &&
        !report.daily.some((point): boolean => point.previousUnitsSold > 0) ? (
          <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t('noSalesTitle')}
          </p>
        ) : (
          <ChartContainer
            className="h-64 w-full sm:h-72"
            config={{
              [current]: { label: t('currentPeriod'), color: 'var(--primary)' },
              [previous]: { label: t('previousPeriod'), color: 'var(--muted-foreground)' },
            }}
            aria-label={t('trend')}
          >
            <ComposedChart
              accessibilityLayer
              data={[...report.daily]}
              margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={date}
                minTickGap={40}
                tickLine={false}
                axisLine={false}
                tickMargin={12}
              />
              <YAxis width={64} tickLine={false} axisLine={false} tickFormatter={compact} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value: unknown): string => {
                      const point = findIntelligenceDay(value, report.daily);
                      return point ? date(point.date) : t('date');
                    }}
                    formatter={(value, name, item): React.ReactNode => {
                      const point = findIntelligenceDay(item.payload, report.daily);
                      if (!point || typeof value !== 'number' || !Number.isFinite(value))
                        return null;
                      const prior = name === previous;
                      return (
                        <div className="flex w-full items-center justify-between gap-5 text-xs">
                          <span className="text-muted-foreground">
                            {t(prior ? 'previousPeriod' : 'currentPeriod')} ·{' '}
                            {date(prior ? point.previousDate : point.date)}
                          </span>
                          <span className="font-medium tabular-nums text-foreground">
                            {exact(value)}
                          </span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar
                dataKey={current}
                name={current}
                fill="var(--primary)"
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
              <Line
                dataKey={previous}
                name={previous}
                type="linear"
                stroke="var(--muted-foreground)"
                strokeDasharray="5 4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t('comparisonHelp')}</p>
        <details className="mt-3 border-t pt-2">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-md text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">
            {t('viewDaily')}
          </summary>
          <div className="mt-2 max-h-72 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead className="text-right">{t('currentPeriod')}</TableHead>
                  <TableHead className="text-right">{t('previousPeriod')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.daily.map((point): React.JSX.Element => (
                  <TableRow key={point.date}>
                    <TableCell>
                      {date(point.date)}
                      <span className="block text-xs text-muted-foreground">
                        {date(point.previousDate)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {exact(point[current])}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {exact(point[previous])}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
