'use client';

import * as React from 'react';
import Form from 'next/form';
import { useTranslations } from 'next-intl';
import type { DashboardOverviewPeriod } from '@canaldigital/packages/core';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { TenantParamField } from '@/features/dashboard/components/tenant-scope';
import { CatalogSearchButton } from '@/features/dashboard/components/catalog-search-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { intelligenceRangeStart } from '@/features/dashboard/utils/business-intelligence-range';

const PRESETS: readonly number[] = [7, 30, 90];

export function DashboardOverviewFilters({
  period,
  maxDate,
}: {
  period: DashboardOverviewPeriod;
  maxDate: string;
}): React.JSX.Element {
  const t = useTranslations('AdminOverview');
  const rangeFrom = intelligenceRangeStart(period);
  const items = PRESETS.map((days): { value: string; label: string } => ({
    value: String(days),
    label: t('days', { count: days }),
  }));
  return (
    <Form
      action="/dashboard"
      scroll={false}
      className="rounded-xl border bg-card px-4 py-4 sm:px-5"
      aria-label={t('filters')}
    >
      <TenantParamField />
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid min-w-48 flex-1 gap-2 sm:max-w-64">
          <Label htmlFor="overview-days">{t('period')}</Label>
          <Select
            key={period.days}
            name="days"
            defaultValue={String(PRESETS.includes(period.days) ? period.days : 30)}
            items={items}
          >
            <SelectTrigger id="overview-days" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item): React.JSX.Element => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-40 flex-1 gap-2 sm:max-w-48">
          <Label htmlFor="overview-from">{t('dateFrom')}</Label>
          <Input
            key={`from-${rangeFrom ?? ''}`}
            id="overview-from"
            name="from"
            type="date"
            max={maxDate}
            defaultValue={rangeFrom ?? ''}
            className="min-h-11"
            aria-describedby="overview-range-help"
          />
        </div>
        <div className="grid min-w-40 flex-1 gap-2 sm:max-w-48">
          <Label htmlFor="overview-to">{t('dateTo')}</Label>
          <Input
            key={`to-${period.endDate ?? ''}`}
            id="overview-to"
            name="to"
            type="date"
            max={maxDate}
            defaultValue={period.endDate ?? ''}
            className="min-h-11"
            aria-describedby="overview-range-help"
          />
        </div>
        <CatalogSearchButton label={t('apply')} pendingLabel={t('updating')} />
      </div>
      <p id="overview-range-help" className="mt-3 text-sm text-muted-foreground">
        {t('rangeHelp')}
      </p>
    </Form>
  );
}
