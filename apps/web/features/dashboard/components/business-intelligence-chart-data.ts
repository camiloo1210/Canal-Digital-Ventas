import type { BusinessIntelligenceReport } from '@canaldigital/packages/core';

/** Chart-library payloads are untrusted; resolve them against our serializable read model. */
export function findIntelligenceDay(
  payload: unknown,
  daily: BusinessIntelligenceReport['daily'],
): BusinessIntelligenceReport['daily'][number] | null {
  const date =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' &&
          payload !== null &&
          'date' in payload &&
          typeof payload.date === 'string'
        ? payload.date
        : null;
  return daily.find((point): boolean => point.date === date) ?? null;
}
