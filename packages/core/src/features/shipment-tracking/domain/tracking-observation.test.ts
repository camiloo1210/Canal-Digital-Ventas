import { describe, expect, it } from 'vitest';
import {
  mergeTrackingObservations,
  type TrackingObservation,
} from '@/shipment-tracking/domain/tracking-observation';

const base: TrackingObservation = {
  providerCode: 'IT',
  status: 'in_transit',
  occurredAt: '2026-11-09T12:00:00Z',
  dateOnly: null,
  receivedAt: '2026-11-09T12:01:00Z',
  fingerprint: 'one',
  mappingVersion: 1,
  providerEventId: null,
};

describe('shipment tracking observations', (): void => {
  it('deduplicates repeated observations without replacing the latest with older data', (): void => {
    const older: TrackingObservation = {
      ...base,
      status: 'label_created',
      fingerprint: 'old',
      occurredAt: '2026-11-08T12:00:00Z',
    };
    const result = mergeTrackingObservations([base], [base, older]);
    expect(result.history).toHaveLength(2);
    expect(result.latest?.status).toBe('in_transit');
  });
  it('preserves a date-only observation without inventing a time', (): void => {
    const observation: TrackingObservation = { ...base, occurredAt: null, dateOnly: '2026-11-09' };
    expect(mergeTrackingObservations([], [observation]).history[0]?.occurredAt).toBeNull();
    expect(mergeTrackingObservations([], [observation]).history[0]?.dateOnly).toBe('2026-11-09');
  });
  it('retains a later return after a delivery', (): void => {
    const delivery: TrackingObservation = { ...base, status: 'delivered' };
    const returned: TrackingObservation = {
      ...base,
      status: 'returned',
      fingerprint: 'return',
      occurredAt: '2026-11-10T12:00:00Z',
    };
    expect(mergeTrackingObservations([delivery], [returned]).latest?.status).toBe('returned');
  });
  it('retains different versions of a provider correction', (): void => {
    const original: TrackingObservation = { ...base, providerEventId: 'event-1' };
    const correction: TrackingObservation = {
      ...original,
      fingerprint: 'corrected',
      status: 'exception',
      receivedAt: '2026-11-09T13:00:00Z',
    };
    const result = mergeTrackingObservations([original], [correction]);
    expect(result.history).toHaveLength(2);
    expect(result.latest?.status).toBe('exception');
  });
});
