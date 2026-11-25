import type { TrackingStatus } from '@/shipment-tracking/domain/tracking-observation';

export type TrackingReadState =
  'pending' | 'current' | 'stale' | 'not_found' | 'unsupported' | 'disabled' | 'unavailable';
export interface TrackingEventReadModel {
  readonly status: TrackingStatus;
  readonly occurredAt: string | null;
  readonly dateOnly: string | null;
}
export interface TrackingReadModel {
  readonly state: TrackingReadState;
  readonly needsAttention?: boolean;
  readonly lastSuccessfulAt: string | null;
  readonly events: readonly TrackingEventReadModel[];
}
export function projectTrackingState(
  source: {
    readonly active: boolean;
    readonly paused?: boolean;
    readonly result: 'found' | 'not_found' | 'unsupported' | null;
    readonly lastSuccessfulAt: string | null;
    readonly lastErrorAt?: string | null;
  },
  now: string,
  staleAfterMs: number,
): TrackingReadState {
  if (!source.active) return 'disabled';
  if (source.paused) return 'unavailable';
  if (!source.lastSuccessfulAt || source.result === null)
    return source.lastErrorAt ? 'unavailable' : 'pending';
  const age = Date.parse(now) - Date.parse(source.lastSuccessfulAt);
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    !Number.isFinite(staleAfterMs) ||
    staleAfterMs <= 0 ||
    age > staleAfterMs
  )
    return 'stale';
  if (source.result === 'not_found') return 'not_found';
  if (source.result === 'unsupported') return 'unsupported';
  return 'current';
}
