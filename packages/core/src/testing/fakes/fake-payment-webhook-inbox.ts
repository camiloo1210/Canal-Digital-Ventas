import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type {
  IngestPaymentWebhookDto,
  PaymentWebhookInboxPort,
  PaymentWebhookReceipt,
} from '@/payments/application/ports/out/payment-webhook-inbox.port';
import type { PaymentEnvironment } from '@/payments/application/ports/out/provider-checkout.port';

/** Mirrors the 1 MiB bound of sales.ingest_payment_webhook_event. */
export const MAX_WEBHOOK_PAYLOAD_BYTES = 1_048_576;

export interface FakeInboxEvent {
  readonly id: string;
  readonly environment: PaymentEnvironment;
  readonly eventName: string;
  readonly providerOrderId: string;
  readonly bodyHash: string;
  readonly payload: Buffer;
}

/**
 * Contract fake of the durable inbox (the real one is the SQL function
 * sales.ingest_payment_webhook_event). Same order of checks: size, signature shape, HMAC-SHA256
 * over the ORIGINAL bytes, JSON/meta checks, store/environment channel, then dedupe on
 * (environment, eventName, providerOrderId, sha256(bytes)). Ids are sequential and deterministic.
 */
export class FakePaymentWebhookInbox implements PaymentWebhookInboxPort {
  public readonly events: FakeInboxEvent[] = [];
  public readonly ingestCalls: { environment: PaymentEnvironment }[] = [];

  public constructor(
    private readonly secret: string,
    private readonly storeId: string,
  ) {}

  /** Test helper: the signature a legitimate sender computes over these exact bytes. */
  public sign(payload: Buffer): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  async ingest(
    input: IngestPaymentWebhookDto,
    environment: PaymentEnvironment,
  ): Promise<PaymentWebhookReceipt> {
    this.ingestCalls.push({ environment });
    const bytes = Buffer.from(input.payloadBase64, 'base64');
    if (bytes.length < 1 || bytes.length > MAX_WEBHOOK_PAYLOAD_BYTES) {
      return { outcome: 'MALFORMED', eventId: null };
    }
    if (!/^[a-fA-F0-9]{64}$/.test(input.signature)) {
      return { outcome: 'INVALID_SIGNATURE', eventId: null };
    }
    const expected = Buffer.from(this.sign(bytes), 'hex');
    const received = Buffer.from(input.signature, 'hex');
    if (!timingSafeEqual(expected, received)) {
      return { outcome: 'INVALID_SIGNATURE', eventId: null };
    }
    let body: unknown;
    try {
      body = JSON.parse(bytes.toString('utf8'));
    } catch {
      return { outcome: 'MALFORMED', eventId: null };
    }
    const root = asRecord(body);
    const meta = asRecord(root?.meta);
    const data = asRecord(root?.data);
    const attributes = asRecord(data?.attributes);
    const eventName = meta?.event_name;
    if (eventName !== input.eventName || data?.type !== 'orders') {
      return { outcome: 'MALFORMED', eventId: null };
    }
    if (eventName !== 'order_created' && eventName !== 'order_refunded') {
      return { outcome: 'IGNORED', eventId: null };
    }
    const resourceId = scalarText(data.id);
    if (resourceId === undefined || !/^[1-9][0-9]*$/.test(resourceId)) {
      return { outcome: 'MALFORMED', eventId: null };
    }
    if (
      scalarText(attributes?.store_id) !== this.storeId ||
      typeof attributes?.test_mode !== 'boolean' ||
      attributes?.test_mode !== (environment === 'test')
    ) {
      return { outcome: 'CHANNEL_MISMATCH', eventId: null };
    }
    const bodyHash = createHash('sha256').update(bytes).digest('hex');
    const existing = this.events.find(
      (event): boolean =>
        event.environment === environment &&
        event.eventName === eventName &&
        event.providerOrderId === resourceId &&
        event.bodyHash === bodyHash,
    );
    if (existing) return { outcome: 'DUPLICATE', eventId: existing.id };
    const id = `inbox-event-${this.events.length + 1}`;
    this.events.push({
      id,
      environment,
      eventName,
      providerOrderId: resourceId,
      bodyHash,
      payload: bytes,
    });
    return { outcome: 'ACCEPTED', eventId: id };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Mirrors jsonb `#>>`: strings and numbers become text, everything else is not a scalar id. */
function scalarText(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}
