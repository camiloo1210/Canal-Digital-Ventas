import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/webhooks/lemon-squeezy/route';

const { ingest, resolve } = vi.hoisted(
  (): { ingest: ReturnType<typeof vi.fn>; resolve: ReturnType<typeof vi.fn> } => ({
    ingest: vi.fn(),
    resolve: vi.fn(),
  }),
);
vi.mock('@/features/payments/di/payments.di', (): object => ({
  paymentsDi: { resolveIngestWebhook: resolve },
}));

describe('payment webhook transport', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
    resolve.mockReturnValue({ execute: ingest });
    ingest.mockResolvedValue({ outcome: 'ACCEPTED', eventId: 'inbox-1' });
  });

  it('delivers the exact raw bytes without requiring a buyer session', async (): Promise<void> => {
    const raw = '{ "data": {"id":"1"}, "unicode": "á" }\n';
    const result = await POST(
      new Request('https://app.test/api/webhooks/lemon-squeezy', {
        method: 'POST',
        body: raw,
        headers: { 'X-Signature': 'a'.repeat(64), 'X-Event-Name': 'order_created' },
      }),
    );
    expect(result.status).toBe(200);
    expect(ingest).toHaveBeenCalledWith({
      payloadBase64: Buffer.from(raw).toString('base64'),
      signature: 'a'.repeat(64),
      eventName: 'order_created',
    });
  });

  it('does not accept a webhook when durable ingestion fails', async (): Promise<void> => {
    ingest.mockRejectedValue(new Error('database credentials must not leak'));
    const result = await POST(
      new Request('https://app.test/api/webhooks/lemon-squeezy', {
        method: 'POST',
        body: '{}',
        headers: { 'X-Signature': 'b'.repeat(64), 'X-Event-Name': 'order_created' },
      }),
    );
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain('credentials');
  });

  it('rejects a body larger than 1 MiB before calling ingestion', async (): Promise<void> => {
    const result = await POST(
      new Request('https://app.test/api/webhooks/lemon-squeezy', {
        method: 'POST',
        body: 'x'.repeat(1_048_577),
        headers: { 'X-Signature': 'a'.repeat(64), 'X-Event-Name': 'order_created' },
      }),
    );
    expect(result.status).toBe(413);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('rejects an absent signature without resolving infrastructure', async (): Promise<void> => {
    const result = await POST(
      new Request('https://app.test/api/webhooks/lemon-squeezy', { method: 'POST', body: '{}' }),
    );
    expect(result.status).toBe(400);
    expect(resolve).not.toHaveBeenCalled();
  });
});
