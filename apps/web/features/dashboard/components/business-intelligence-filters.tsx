'use client';

import * as React from 'react';
import Form from 'next/form';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import type { IntelligenceQuery } from '@canaldigital/packages/core';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { CatalogSearchButton } from '@/features/dashboard/components/catalog-search-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Stable client identity across query navigations; only individual uncontrolled fields reset. */
export function BusinessIntelligenceFilters({
  query,
}: {
  query: IntelligenceQuery;
}): React.JSX.Element {
  const t = useTranslations('BusinessIntelligence');
  return (
    <Form
      action="/dashboard/business-intelligence"
      scroll={false}
      className="rounded-xl border bg-card px-4 py-4 sm:px-5"
      aria-label={t('filters')}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-48 flex-1 gap-2 sm:max-w-64">
          <Label htmlFor="bi-days">{t('period')}</Label>
          <Select
            key={query.days}
            name="days"
            defaultValue={String(query.days)}
            items={[7, 30, 90].map((days): { value: string; label: string } => ({
              value: String(days),
              label: t('days', { count: days }),
            }))}
          >
            <SelectTrigger id="bi-days" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[7, 30, 90].map((days): React.JSX.Element => (
                <SelectItem key={days} value={String(days)}>
                  {t('days', { count: days })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="hidden max-w-72 flex-1 text-sm text-muted-foreground lg:block">
          {t('filterHint')}
        </p>
        <CatalogSearchButton label={t('apply')} pendingLabel={t('updating')} />
      </div>
      <details className="group mt-4 border-t pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-md text-sm focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">{t('restockSettings')}</span>
          <span className="text-muted-foreground">
            {t('scenarioSummary', { lead: query.leadTimeDays, coverage: query.targetCoverageDays })}
          </span>
          <ChevronDown
            className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </summary>
        <div className="grid gap-4 pb-1 pt-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="bi-lead">{t('leadTime')}</Label>
            <Input
              key={query.leadTimeDays}
              id="bi-lead"
              name="leadTimeDays"
              type="number"
              min={1}
              max={90}
              required
              defaultValue={query.leadTimeDays}
              className="min-h-11"
              aria-describedby="bi-lead-help"
            />
            <p id="bi-lead-help" className="text-sm text-muted-foreground">
              {t('leadHelp')}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bi-coverage">{t('targetCoverage')}</Label>
            <Input
              key={query.targetCoverageDays}
              id="bi-coverage"
              name="targetCoverageDays"
              type="number"
              min={1}
              max={90}
              required
              defaultValue={query.targetCoverageDays}
              className="min-h-11"
              aria-describedby="bi-coverage-help"
            />
            <p id="bi-coverage-help" className="text-sm text-muted-foreground">
              {t('coverageSettingHelp')}
            </p>
          </div>
        </div>
      </details>
    </Form>
  );
}
