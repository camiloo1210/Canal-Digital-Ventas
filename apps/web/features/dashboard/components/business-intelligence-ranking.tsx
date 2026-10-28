'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { BusinessIntelligenceReport } from '@canaldigital/packages/core';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { intelligenceMoney } from '@/features/dashboard/components/business-intelligence-format';

export function BusinessIntelligenceRanking({
  report,
}: {
  report: BusinessIntelligenceReport;
}): React.JSX.Element {
  const t = useTranslations('BusinessIntelligence');
  const locale = useLocale();
  const [metric, setMetric] = React.useState<'revenue' | 'units'>('revenue');
  const products = report.productRankings[metric];
  const key = metric === 'revenue' ? 'revenueCents' : 'unitsSold';
  const exact = (value: number): string =>
    metric === 'revenue'
      ? intelligenceMoney(value, report.currency, locale)
      : new Intl.NumberFormat(locale).format(value);
  return (
    <Card className="min-w-0 sm:[--card-spacing:--spacing(5)]">
      <CardHeader className="gap-3">
        <div>
          <CardTitle>{t('rankingTitle')}</CardTitle>
          <CardDescription className="mt-1.5">{t('rankingHelp')}</CardDescription>
        </div>
        <div
          role="group"
          aria-label={t('rankingMetric')}
          className="flex w-fit gap-1 rounded-lg bg-muted p-1"
        >
          {(['revenue', 'units'] as const).map((value): React.JSX.Element => (
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
        {products.length === 0 ? (
          <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t('rankingEmpty')}
          </p>
        ) : (
          <>
            <ChartContainer
              config={{ [key]: { label: t(`chartMetrics.${metric}`), color: 'var(--primary)' } }}
              className="h-64 w-full"
              aria-label={t('rankingTitle')}
            >
              <BarChart
                accessibilityLayer
                layout="vertical"
                data={[...products]}
                margin={{ left: 0, right: 12, top: 4, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickCount={3}
                  tickFormatter={(value: number): string =>
                    new Intl.NumberFormat(locale, {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(metric === 'revenue' ? value / 100 : value)
                  }
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: string): string =>
                    value.length > 15 ? `${value.slice(0, 14)}…` : value
                  }
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value): React.ReactNode =>
                        typeof value === 'number' && Number.isFinite(value) ? (
                          <span className="font-medium tabular-nums">{exact(value)}</span>
                        ) : null
                      }
                    />
                  }
                />
                <Bar
                  dataKey={key}
                  fill="var(--primary)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
            <p className="mt-3 text-xs text-muted-foreground">
              {t(metric === 'revenue' ? 'rankingSalesUnit' : 'rankingUnitsUnit', {
                currency: report.currency,
              })}
            </p>
          </>
        )}
        <details className="mt-4 border-t pt-2">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-md text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">
            {t('rankingDetails')}
          </summary>
          <ol className="divide-y">
            {products.map((product): React.JSX.Element => (
              <li key={product.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <span className="min-w-0 break-words">{product.name}</span>
                <span className="shrink-0 font-medium tabular-nums">{exact(product[key])}</span>
              </li>
            ))}
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}
