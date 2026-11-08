import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { IngestPaymentWebhookUseCase } from '@/payments/application/use-cases/ingest-payment-webhook.use-case';
import type {
  IngestPaymentWebhookDto,
  PaymentWebhookInboxPort,
  PaymentWebhookReceipt,
} from '@/payments/application/ports/out/payment-webhook-inbox.port';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';
import {
  FakePaymentWebhookInbox,
  MAX_WEBHOOK_PAYLOAD_BYTES,
} from '@/testing/fakes/fake-payment-webhook-inbox';

const SECRET = 'whsec-test-fixed-secret';
const STORE_ID = '4242';

function orderEvent(
  overrides: {
    eventName?: string;
    storeId?: string;
    testMode?: boolean;
    id?: string;
    padding?: string;
  } = {},
): Buffer {
  return Buffer.from(
    JSON.stringify({
      meta: {
        event_name: overrides.eventName ?? 'order_created',
        padding: overrides.padding ?? '',
      },
      data: {
        type: 'orders',
        id: overrides.id ?? '1001',
        attributes: {
          store_id: overrides.storeId ?? STORE_ID,
          test_mode: overrides.testMode ?? true,
        },
      },
    }),
    'utf8',
  );
}

function sign(bytes: Buffer): string {
  return createHmac('sha256', SECRET).update(bytes).digest('hex');
}

function dtoFor(
  bytes: Buffer,
  eventName = 'order_created',
  signature = sign(bytes),
): IngestPaymentWebhookDto {
  return { payloadBase64: bytes.toString('base64'), signature, eventName };
}

describe('IngestPaymentWebhookUseCase', () => {
  let inbox: FakePaymentWebhookInbox;
  let useCase: IngestPaymentWebhookUseCase;

  beforeEach(() => {
    inbox = new FakePaymentWebhookInbox(SECRET, STORE_ID);
    useCase = new IngestPaymentWebhookUseCase(inbox, 'test');
  });

  describe('delegation (the use case itself)', () => {
    it('forwards the untouched input and its configured environment to the inbox', async (): Promise<void> => {
      const ingest = vi
        .fn<PaymentWebhookInboxPort['ingest']>()
        .mockResolvedValue({ outcome: 'ACCEPTED', eventId: 'evt-1' });
      const input: IngestPaymentWebhookDto = {
        payloadBase64: 'e30=',
        signature: 'a'.repeat(64),
        eventName: 'order_created',
      };

      const receipt = await new IngestPaymentWebhookUseCase({ ingest }, 'production').execute(
        input,
      );

      expect(receipt).toEqual({ outcome: 'ACCEPTED', eventId: 'evt-1' });
      expect(ingest).toHaveBeenCalledExactlyOnceWith(input, 'production');
    });

    it('propagates inbox infrastructure failures', async (): Promise<void> => {
      const failure = new PaymentRepositoryException('Unable to persist the payment webhook.');
      const inboxStub: PaymentWebhookInboxPort = {
        ingest: vi.fn<PaymentWebhookInboxPort['ingest']>().mockRejectedValue(failure),
      };

      await expect(
        new IngestPaymentWebhookUseCase(inboxStub, 'test').execute(dtoFor(orderEvent())),
      ).rejects.toBe(failure);
    });
  });

  // The checks below are enforced by the durable inbox (SQL function
  // sales.ingest_payment_webhook_event); FakePaymentWebhookInbox mirrors its contract so the
  // use-case boundary and the route outcomes are pinned. Real enforcement needs an integration test.
  describe('inbox contract through the use case', () => {
    it('accepts a correctly signed event and stores exactly one inbox row', async (): Promise<void> => {
      const receipt = await useCase.execute(dtoFor(orderEvent()));

      expect(receipt).toEqual<PaymentWebhookReceipt>({
        outcome: 'ACCEPTED',
        eventId: 'inbox-event-1',
      });
      expect(inbox.events).toHaveLength(1);
      expect(inbox.events[0]?.providerOrderId).toBe('1001');
    });

    it('rejects a signature from a different secret and stores nothing', async (): Promise<void> => {
      const bytes = orderEvent();
      const forged = createHmac('sha256', 'another-secret').update(bytes).digest('hex');

      const receipt = await useCase.execute(dtoFor(bytes, 'order_created', forged));

      expect(receipt).toEqual({ outcome: 'INVALID_SIGNATURE', eventId: null });
      expect(inbox.events).toEqual([]);
    });

    it.each(['', 'not-hex', 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64)])(
      'rejects a malformed signature %j',
      async (signature): Promise<void> => {
        const receipt = await useCase.execute(dtoFor(orderEvent(), 'order_created', signature));
        expect(receipt.outcome).toBe('INVALID_SIGNATURE');
        expect(inbox.events).toEqual([]);
      },
    );

    it('verifies the signature against the ORIGINAL bytes: a re-serialized body with the same content fails', async (): Promise<void> => {
      const original = orderEvent();
      const signature = sign(original);
      const reSerialized = Buffer.from(
        JSON.stringify(JSON.parse(original.toString('utf8')), null, 2),
        'utf8',
      );
      expect(reSerialized.equals(original)).toBe(false);

      const receipt = await useCase.execute(dtoFor(reSerialized, 'order_created', signature));

      expect(receipt).toEqual({ outcome: 'INVALID_SIGNATURE', eventId: null });
      expect(inbox.events).toEqual([]);
    });

    it('returns MALFORMED for a validly signed body that is not JSON', async (): Promise<void> => {
      const bytes = Buffer.from('{not json', 'utf8');
      const receipt = await useCase.execute(dtoFor(bytes));
      expect(receipt).toEqual({ outcome: 'MALFORMED', eventId: null });
      expect(inbox.events).toEqual([]);
    });

    it('returns MALFORMED for an empty body', async (): Promise<void> => {
      const receipt = await useCase.execute({
        payloadBase64: '',
        signature: sign(Buffer.alloc(0)),
        eventName: 'order_created',
      });
      expect(receipt.outcome).toBe('MALFORMED');
    });

    it('returns MALFORMED when the X-Event-Name header differs from meta.event_name', async (): Promise<void> => {
      const receipt = await useCase.execute(
        dtoFor(orderEvent({ eventName: 'order_created' }), 'order_refunded'),
      );
      expect(receipt.outcome).toBe('MALFORMED');
      expect(inbox.events).toEqual([]);
    });

    it('returns MALFORMED for a non-numeric provider order id', async (): Promise<void> => {
      const receipt = await useCase.execute(dtoFor(orderEvent({ id: '12; DROP' })));
      expect(receipt.outcome).toBe('MALFORMED');
    });

    it('ignores event types the system does not consume, without storing them', async (): Promise<void> => {
      const receipt = await useCase.execute(
        dtoFor(orderEvent({ eventName: 'subscription_created' }), 'subscription_created'),
      );
      expect(receipt).toEqual({ outcome: 'IGNORED', eventId: null });
      expect(inbox.events).toEqual([]);
    });

    it('accepts a numeric store_id, as Lemon Squeezy sends it (SQL compares as text)', async (): Promise<void> => {
      const bytes = Buffer.from(
        JSON.stringify({
          meta: { event_name: 'order_created' },
          data: { type: 'orders', id: '1001', attributes: { store_id: 4242, test_mode: true } },
        }),
        'utf8',
      );
      const receipt = await useCase.execute(dtoFor(bytes));
      expect(receipt.outcome).toBe('ACCEPTED');
    });

    it('rejects a replay of a test-mode body signed for the test channel when delivered to production', async (): Promise<void> => {
      const input = dtoFor(orderEvent());
      await useCase.execute(input);
      const production = new IngestPaymentWebhookUseCase(inbox, 'production');
      const receipt = await production.execute(input);
      expect(receipt.outcome).toBe('CHANNEL_MISMATCH');
      expect(inbox.events).toHaveLength(1);
    });

    it('returns CHANNEL_MISMATCH for another store', async (): Promise<void> => {
      const receipt = await useCase.execute(dtoFor(orderEvent({ storeId: '9999' })));
      expect(receipt).toEqual({ outcome: 'CHANNEL_MISMATCH', eventId: null });
      expect(inbox.events).toEqual([]);
    });

    it('returns CHANNEL_MISMATCH for a live-mode event delivered to the test environment', async (): Promise<void> => {
      const receipt = await useCase.execute(dtoFor(orderEvent({ testMode: false })));
      expect(receipt.outcome).toBe('CHANNEL_MISMATCH');
    });

    it('returns CHANNEL_MISMATCH for a test-mode event delivered to the production environment', async (): Promise<void> => {
      const production = new IngestPaymentWebhookUseCase(inbox, 'production');
      const receipt = await production.execute(dtoFor(orderEvent({ testMode: true })));
      expect(receipt.outcome).toBe('CHANNEL_MISMATCH');
      expect(inbox.events).toEqual([]);
    });

    it('stores one inbox event when the same valid payload is delivered twice', async (): Promise<void> => {
      const input = dtoFor(orderEvent());

      const first = await useCase.execute(input);
      const second = await useCase.execute(input);

      expect(first).toEqual({ outcome: 'ACCEPTED', eventId: 'inbox-event-1' });
      expect(second).toEqual({ outcome: 'DUPLICATE', eventId: 'inbox-event-1' });
      expect(inbox.events).toHaveLength(1);
    });

    it('stores a distinct row for the same provider order with a different body', async (): Promise<void> => {
      await useCase.execute(dtoFor(orderEvent()));
      const receipt = await useCase.execute(dtoFor(orderEvent({ padding: 'x' })));
      expect(receipt.outcome).toBe('ACCEPTED');
      expect(inbox.events).toHaveLength(2);
    });

    it('accepts a payload of exactly the size limit and rejects one byte more', async (): Promise<void> => {
      const base = orderEvent({ padding: '' }).length;
      const atLimit = orderEvent({ padding: 'x'.repeat(MAX_WEBHOOK_PAYLOAD_BYTES - base) });
      const overLimit = orderEvent({ padding: 'x'.repeat(MAX_WEBHOOK_PAYLOAD_BYTES - base + 1) });
      expect(atLimit.length).toBe(MAX_WEBHOOK_PAYLOAD_BYTES);
      expect(overLimit.length).toBe(MAX_WEBHOOK_PAYLOAD_BYTES + 1);

      const over = await useCase.execute(dtoFor(overLimit));
      expect(over).toEqual({ outcome: 'MALFORMED', eventId: null });
      expect(inbox.events).toEqual([]);

      const at = await useCase.execute(dtoFor(atLimit));
      expect(at.outcome).toBe('ACCEPTED');
    });
  });
});
