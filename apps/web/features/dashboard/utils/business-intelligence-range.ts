export interface PeriodLike {
  readonly days: number;
  readonly endDate?: string;
}

export const DAY_MS = 86400000;

/** First day (YYYY-MM-DD) of a custom range, or null when the preset period is used. */
export function intelligenceRangeStart(query: PeriodLike): string | null {
  if (!query.endDate) return null;
  return new Date(Date.parse(`${query.endDate}T00:00:00Z`) - (query.days - 1) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Stable identity for a query, used for Suspense and client state keys. */
export function intelligenceQueryKey(
  query: PeriodLike & { readonly leadTimeDays?: number; readonly targetCoverageDays?: number },
): string {
  return [query.days, query.endDate ?? 'preset', query.leadTimeDays, query.targetCoverageDays].join(
    '-',
  );
}
