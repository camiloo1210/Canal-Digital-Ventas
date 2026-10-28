import { describe, expect, it } from 'vitest';
import type { BusinessIntelligenceReport } from '@canaldigital/packages/core';
import { findIntelligenceDay } from '@/features/dashboard/components/business-intelligence-chart-data';

const daily: BusinessIntelligenceReport['daily'] = [
  {
    date: '2026-10-24',
    previousDate: '2026-10-17',
    revenueCents: 100,
    previousRevenueCents: 0,
    estimatedProfitCents: 50,
    previousEstimatedProfitCents: 0,
    unitsSold: 1,
    previousUnitsSold: 0,
  },
];

describe('chart payload boundary', (): void => {
  it('resolves chart dates only against the trusted report', (): void => {
    expect(findIntelligenceDay('2026-10-24', daily)).toBe(daily[0]);
    expect(findIntelligenceDay({ date: '2026-10-24', revenueCents: 'invalid' }, daily)).toBe(
      daily[0],
    );
  });
  it('rejects missing, malformed and unknown chart payloads', (): void => {
    for (const payload of [
      undefined,
      null,
      42,
      [],
      { date: 42 },
      { date: 'not-a-date' },
      '2026-11-01',
    ]) {
      expect(findIntelligenceDay(payload, daily)).toBeNull();
    }
  });
});
