import { TrackingAuthorizationException } from '@/shipment-tracking/application/tracking-authorization.exception';
import { createHash } from 'node:crypto';
import type {
  TrackingObservation,
  TrackingStatus,
} from '@/shipment-tracking/domain/tracking-observation';
import type {
  TrackingProviderPort,
  TrackingProviderResult,
} from '@/shipment-tracking/application/ports/out/tracking-provider.port';
import { FedexTrackingException } from '@/shipment-tracking/infrastructure/fedex/fedex-auth.adapter';

export class FedexRateLimitException extends FedexTrackingException {
  public constructor(public readonly retryAfterSeconds: number | null) {
    super('FedEx rate limit exceeded');
  }
}

interface FedexTokenSource {
  getToken(ref: string): Promise<string>;
  invalidate(ref: string): void;
}
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function status(code: string): TrackingStatus {
  switch (code) {
    case 'OC':
      return 'label_created';
    case 'IT':
    case 'AR':
    case 'DP':
    case 'AF':
      return 'in_transit';
    case 'OD':
      return 'out_for_delivery';
    case 'DL':
      return 'delivered';
    case 'DE':
    case 'DD':
    case 'SE':
      return 'exception';
    default:
      return 'unknown';
  }
}
async function readJson(response: Response): Promise<unknown> {
  if (!response.body) throw new FedexTrackingException('FedEx tracking response invalid');
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1048576) {
        await reader.cancel();
        throw new FedexTrackingException('FedEx tracking response invalid');
      }
      parts.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export class FedexTrackingAdapter implements TrackingProviderPort {
  public constructor(
    private readonly auth: FedexTokenSource,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = (): Date => new Date(),
  ) {}
  public async track(input: {
    readonly trackingNumber: string;
    readonly credentialRef: string;
    readonly environment: 'sandbox';
  }): Promise<TrackingProviderResult> {
    if (
      input.environment !== 'sandbox' ||
      !input.trackingNumber ||
      input.trackingNumber.length > 120
    )
      throw new FedexTrackingException('Invalid tracking request');
    try {
      let token = await this.auth.getToken(input.credentialRef);
      const request = async (): Promise<Response> =>
        this.fetcher('https://apis-sandbox.fedex.com/track/v1/trackingnumbers', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            trackingInfo: [{ trackingNumberInfo: { trackingNumber: input.trackingNumber } }],
            includeDetailedScans: true,
          }),
        });
      let response = await request();
      if (response.status === 401) {
        this.auth.invalidate(input.credentialRef);
        token = await this.auth.getToken(input.credentialRef);
        response = await request();
      }
      if (response.status === 401 || response.status === 403)
        throw new TrackingAuthorizationException();
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const seconds =
          retryAfter !== null && /^\d+$/.test(retryAfter)
            ? Number(retryAfter)
            : retryAfter !== null && Number.isFinite(Date.parse(retryAfter))
              ? Math.max(0, Math.ceil((Date.parse(retryAfter) - this.now().getTime()) / 1000))
              : null;
        throw new FedexRateLimitException(
          seconds !== null && Number.isSafeInteger(seconds) ? seconds : null,
        );
      }
      if (!response.ok) throw new FedexTrackingException('FedEx tracking request failed');
      const payload = record(await readJson(response));
      const errors = Array.isArray(payload?.errors) ? payload.errors : [];
      if (
        errors.some(
          (error: unknown): boolean =>
            record(error)?.code === 'TRACKING.AUTHENTICATEDDELIVERY.ERROR',
        )
      )
        return { kind: 'unsupported' };
      if (errors.length > 0) throw new FedexTrackingException('FedEx tracking response invalid');
      const output = record(payload?.output);
      const complete = Array.isArray(output?.completeTrackResults)
        ? output.completeTrackResults
        : [];
      if (complete.length !== 1)
        throw new FedexTrackingException('FedEx tracking response ambiguous');
      const group = record(complete[0]);
      if (group?.trackingNumber !== input.trackingNumber)
        throw new FedexTrackingException('FedEx tracking response ambiguous');
      const results = Array.isArray(group.trackResults) ? group.trackResults : [];
      if (results.length !== 1)
        throw new FedexTrackingException('FedEx tracking response ambiguous');
      const result = record(results[0]);
      const nestedError = record(result?.error);
      if (nestedError?.code === 'TRACKING.AUTHENTICATEDDELIVERY.ERROR')
        return { kind: 'unsupported' };
      if (nestedError) throw new FedexTrackingException('FedEx tracking response invalid');
      if (record(result?.trackingNumberInfo)?.trackingNumber !== input.trackingNumber)
        throw new FedexTrackingException('FedEx tracking response ambiguous');
      if (!Array.isArray(result?.scanEvents))
        throw new FedexTrackingException('FedEx tracking response invalid');
      const receivedAt = this.now().toISOString();
      const observations: TrackingObservation[] = result.scanEvents.map(
        (item: unknown): TrackingObservation => {
          const event = record(item);
          const code = typeof event?.eventType === 'string' ? event.eventType : '';
          if (!/^[A-Z0-9_]{1,40}$/.test(code))
            throw new FedexTrackingException('FedEx tracking response invalid');
          const raw = typeof event?.date === 'string' ? event.date : '';
          const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
          const occurredAt =
            dateOnly === null &&
            /(?:Z|[+-]\d\d:\d\d)$/.test(raw) &&
            Number.isFinite(Date.parse(raw))
              ? new Date(raw).toISOString()
              : null;
          const fingerprint = createHash('sha256')
            .update(JSON.stringify(['fedex', code, occurredAt, dateOnly]))
            .digest('hex');
          return {
            providerCode: code,
            providerEventId: null,
            status: status(code),
            occurredAt,
            dateOnly,
            receivedAt,
            fingerprint,
            mappingVersion: 1,
          };
        },
      );
      return { kind: 'found', observations };
    } catch (error: unknown) {
      if (
        error instanceof FedexTrackingException ||
        error instanceof TrackingAuthorizationException
      )
        throw error;
      throw new FedexTrackingException('FedEx tracking request failed');
    }
  }
}
