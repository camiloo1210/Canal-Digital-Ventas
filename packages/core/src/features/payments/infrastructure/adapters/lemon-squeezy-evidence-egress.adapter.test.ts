import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { LemonSqueezyEvidenceEgressAdapter } from '@/payments/infrastructure/adapters/lemon-squeezy-evidence-egress.adapter';
import type { PaymentEvidenceRecorderPort } from '@/payments/application/ports/out/payment-evidence-recorder.port';
const ticket = {
  ticketId: '550e8400-e29b-41d4-a716-446655440001',
  url: 'https://api.lemonsqueezy.com/v1/orders/123',
  environment: 'test' as const,
};
describe('Independent GET evidence egress', (): void => {
  afterEach((): void => {
    vi.unstubAllGlobals();
  });
  it('records exact response bytes, SHA256 and only allowed headers', async (): Promise<void> => {
    const body = ' {"data":{"type":"orders"}}\n';
    const recorder: PaymentEvidenceRecorderPort = {
      record: vi.fn().mockResolvedValue('verification'),
    };
    const request = vi.fn(
      async (): Promise<Response> =>
        new Response(body, {
          status: 200,
          headers: {
            'content-type': 'application/vnd.api+json',
            'set-cookie': 'private',
            'x-request-id': 'request',
          },
        }),
    );
    vi.stubGlobal('fetch', request);
    expect(
      await new LemonSqueezyEvidenceEgressAdapter('key', 'test', recorder).verify(ticket, 'worker'),
    ).toBe('verification');
    expect(request).toHaveBeenCalledWith(
      ticket.url,
      expect.objectContaining({ method: 'GET', redirect: 'error' }),
    );
    expect(recorder.record).toHaveBeenCalledWith({
      ticketId: ticket.ticketId,
      workerToken: 'worker',
      url: ticket.url,
      httpStatus: 200,
      payload: new TextEncoder().encode(body),
      sha256: createHash('sha256').update(body).digest('hex'),
      headers: { 'content-type': 'application/vnd.api+json', 'x-request-id': 'request' },
    });
  });
  it.each([
    'https://api.lemonsqueezy.com.attacker.invalid/v1/orders/123',
    'https://api.lemonsqueezy.com/v1/orders/123/refund',
    'http://api.lemonsqueezy.com/v1/orders/123',
    'https://api.lemonsqueezy.com/v1/orders/123?include=customer',
  ])('rejects untrusted URL %s before GET', async (url: string): Promise<void> => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const recorder: PaymentEvidenceRecorderPort = { record: vi.fn() };
    await expect(
      new LemonSqueezyEvidenceEgressAdapter('key', 'test', recorder).verify(
        { ...ticket, url },
        'worker',
      ),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('does not cross environment boundaries', async (): Promise<void> => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const recorder: PaymentEvidenceRecorderPort = { record: vi.fn() };
    await expect(
      new LemonSqueezyEvidenceEgressAdapter('key', 'production', recorder).verify(ticket, 'worker'),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('does not record a 201 response as evidence', async (): Promise<void> => {
    vi.stubGlobal('fetch', async (): Promise<Response> => new Response('{}', { status: 201 }));
    const recorder: PaymentEvidenceRecorderPort = { record: vi.fn() };
    await expect(
      new LemonSqueezyEvidenceEgressAdapter('key', 'test', recorder).verify(ticket, 'worker'),
    ).rejects.toThrow();
    expect(recorder.record).not.toHaveBeenCalled();
  });
  it('rejects oversized responses before recording', async (): Promise<void> => {
    vi.stubGlobal('fetch', async (): Promise<Response> => new Response('a'.repeat(1048577)));
    const recorder: PaymentEvidenceRecorderPort = { record: vi.fn() };
    await expect(
      new LemonSqueezyEvidenceEgressAdapter('key', 'test', recorder).verify(ticket, 'worker'),
    ).rejects.toThrow();
    expect(recorder.record).not.toHaveBeenCalled();
  });
});
