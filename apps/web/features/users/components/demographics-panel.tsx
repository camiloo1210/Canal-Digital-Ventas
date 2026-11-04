import { ChartNoAxesColumn, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type {
  DemographicDimensionStats,
  DemographicStatsReadModel,
} from '@canaldigital/packages/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Dimension = 'ageRange' | 'gender' | 'province';

async function DimensionStats({
  dimension,
  stats,
  minBucket,
  minTotal,
}: {
  dimension: Dimension;
  stats: DemographicDimensionStats;
  minBucket: number;
  minTotal: number;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('Users.demographics');
  const total = stats.buckets.reduce((sum, bucket): number => sum + bucket.count, 0);
  const max = Math.max(1, ...stats.buckets.map((bucket): number => bucket.count));
  const title = t(`dimensions.${dimension}`);
  return (
    <section aria-labelledby={`demo-${dimension}`} className="space-y-3">
      <h3 id={`demo-${dimension}`} className="text-sm font-semibold">
        {title}
      </h3>
      {stats.buckets.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('noData', { min: minBucket, total: minTotal })}
        </p>
      ) : (
        <ul className="space-y-2">
          {stats.buckets.map((bucket): React.JSX.Element => (
            <li key={bucket.value} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{t(`values.${dimension}.${bucket.value}`)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {bucket.count} ({Math.round((bucket.count / total) * 100)}%)
                </span>
              </div>
              <div
                role="img"
                aria-label={`${t(`values.${dimension}.${bucket.value}`)}: ${bucket.count}`}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(bucket.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {stats.hasSuppressed && (
        <p className="text-xs text-muted-foreground">{t('suppressed', { min: minBucket })}</p>
      )}
    </section>
  );
}

export async function DemographicsPanel({
  stats,
  minBucket,
  minTotal,
}: {
  stats: DemographicStatsReadModel;
  minBucket: number;
  minTotal: number;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('Users.demographics');
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartNoAxesColumn aria-hidden="true" className="size-5" />
          <h2>{t('title')}</h2>
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{t('privacy', { min: minBucket, total: minTotal })}</span>
        </p>
        <div className="grid gap-8 md:grid-cols-3">
          <DimensionStats
            dimension="ageRange"
            stats={stats.ageRange}
            minBucket={minBucket}
            minTotal={minTotal}
          />
          <DimensionStats
            dimension="gender"
            stats={stats.gender}
            minBucket={minBucket}
            minTotal={minTotal}
          />
          <DimensionStats
            dimension="province"
            stats={stats.province}
            minBucket={minBucket}
            minTotal={minTotal}
          />
        </div>
      </CardContent>
    </Card>
  );
}
