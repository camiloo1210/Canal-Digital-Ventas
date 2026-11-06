import { z } from 'zod';
import { MAX_INTELLIGENCE_DAYS, type IntelligenceQuery } from '@canaldigital/packages/core';

import { DAY_MS } from '@/features/dashboard/utils/business-intelligence-range';

export type IntelligenceSearchParams = Record<string, string | string[] | undefined>;

const daysSchema = z.enum(['7', '30', '90']).catch('30');
const daysByValue = { '7': 7, '30': 30, '90': 90 } as const;
const positiveDays = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(90));
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function dayStart(value: string): number | null {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export interface IntelligencePeriod {
  readonly days: number;
  readonly endDate?: string;
}

/**
 * A valid `from`/`to` pair (inclusive, UTC, not in the future, at most one year) wins over the
 * preset `days`. Anything malformed falls back to the preset instead of failing the page.
 */
export function parseIntelligencePeriod(
  params: IntelligenceSearchParams,
  now: Date = new Date(),
): IntelligencePeriod {
  const from = isoDay.safeParse(params.from);
  const to = isoDay.safeParse(params.to);
  if (from.success && to.success) {
    const start = dayStart(from.data);
    const end = dayStart(to.data);
    if (start !== null && end !== null && start <= end && to.data <= todayIso(now)) {
      const days = Math.round((end - start) / DAY_MS) + 1;
      if (days <= MAX_INTELLIGENCE_DAYS) return { days, endDate: to.data };
    }
  }
  return { days: daysByValue[daysSchema.parse(params.days)] };
}

export function parseIntelligenceQuery(
  params: IntelligenceSearchParams,
  now: Date = new Date(),
): IntelligenceQuery {
  return {
    ...parseIntelligencePeriod(params, now),
    leadTimeDays: positiveDays.catch(7).parse(params.leadTimeDays),
    targetCoverageDays: positiveDays.catch(30).parse(params.targetCoverageDays),
  };
}
