export type TrackingStatus =
  | 'unknown'
  | 'label_created'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'returned';

export interface TrackingObservation {
  readonly providerCode: string;
  readonly providerEventId: string | null;
  readonly status: TrackingStatus;
  readonly occurredAt: string | null;
  readonly dateOnly: string | null;
  readonly receivedAt: string;
  readonly fingerprint: string;
  readonly mappingVersion: number;
}

export function mergeTrackingObservations(
  existing: readonly TrackingObservation[],
  incoming: readonly TrackingObservation[],
): {
  readonly history: readonly TrackingObservation[];
  readonly latest: TrackingObservation | null;
} {
  const unique = new Map<string, TrackingObservation>();
  for (const observation of [...existing, ...incoming]) {
    if (!unique.has(observation.fingerprint)) unique.set(observation.fingerprint, observation);
  }
  const history = [...unique.values()];
  let latest: TrackingObservation | null = null;
  for (const observation of history) {
    if (observation.occurredAt === null) continue;
    const occurred = Date.parse(observation.occurredAt);
    if (!Number.isFinite(occurred)) continue;
    if (
      latest === null ||
      occurred > Date.parse(latest.occurredAt as string) ||
      (occurred === Date.parse(latest.occurredAt as string) &&
        observation.providerEventId !== null &&
        observation.providerEventId === latest.providerEventId &&
        Date.parse(observation.receivedAt) > Date.parse(latest.receivedAt))
    )
      latest = observation;
  }
  return { history, latest };
}
