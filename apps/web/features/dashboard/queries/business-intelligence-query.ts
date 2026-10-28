import { z } from 'zod';
import type { IntelligenceQuery } from '@canaldigital/packages/core';

export type IntelligenceSearchParams = Record<string, string | string[] | undefined>;

const daysSchema = z.enum(['7', '30', '90']).catch('30');
const daysByValue = { '7': 7, '30': 30, '90': 90 } as const;
const positiveDays = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(90));

export function parseIntelligenceQuery(params: IntelligenceSearchParams): IntelligenceQuery {
  return {
    days: daysByValue[daysSchema.parse(params.days)],
    leadTimeDays: positiveDays.catch(7).parse(params.leadTimeDays),
    targetCoverageDays: positiveDays.catch(30).parse(params.targetCoverageDays),
  };
}
