import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/kivi/order-lookup/route';
import { getKiviOrderLookupReadRepository } from '@/features/kivi/di/kivi.di';
import { signKiviOrderLookup } from '@canaldigital/packages/core';

vi.mock('@/features/kivi/di/kivi.di', (): object => ({
  getKiviOrderLookupReadRepository: vi.fn(),
}));

const MASTER = Buffer.alloc(32, 5);
const TENANT = '11111111-1111-4111-8111-111111111111';
const findLatestOrders = vi.fn();

function body(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    tenantId: TENANT,
    phone: '573001112233',
    orderNumber: null,
    ...overrides,
  });
}

function signed(
  raw: string,
  timestamp: string = String(Math.floor(Date.now() / 1000)),
  signTenant: string = TENANT,
): Request {
  return new Request('http://localhost/api/kivi/order-lookup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Kivi-Timestamp': timestamp,
      'X-Kivi-Signature': signKiviOrderLookup(MASTER, signTenant, timestamp, raw),
    },
    body: raw,
  });
}

describe('POST /api/kivi/order-lookup', (): void => {
  beforeEach((): void => {
    vi.stubEnv('KIVI_TOKEN_ENCRYPTION_KEY', MASTER.toString('base64'));
    findLatestOrders.mockReset().mockResolvedValue([]);
    vi.mocked(getKiviOrderLookupReadRepository).mockReturnValue({ findLatestOrders });
  });
  afterEach((): void => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns 503 when the master key is missing or malformed', async (): Promise<void> => {
    vi.stubEnv('KIVI_TOKEN_ENCRYPTION_KEY', 'short');
    const response = await POST(signed(body()));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'unavailable' });
    expect(findLatestOrders).not.toHaveBeenCalled();
  });

  it('returns 401 without calling the port for bad authentication', async (): Promise<void> => {
    const raw = body();
    const stale = signed(raw, String(Math.floor(Date.now() / 1000) - 1000));
    const tampered = signed(raw);
    const missing = new Request('http://localhost/x', { method: 'POST', body: raw });
    const wrongBody = new Request('http://localhost/x', {
      method: 'POST',
      headers: tampered.headers,
      body: body({ phone: '573009998877' }),
    });
    for (const request of [stale, missing, wrongBody]) {
      const response = await POST(request);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
    }
    expect(findLatestOrders).not.toHaveBeenCalled();
  });

  it('returns 401 for a signature made for another tenant id', async (): Promise<void> => {
    const other = '22222222-2222-4222-8222-222222222222';
    const response = await POST(signed(body(), undefined, other));
    expect(response.status).toBe(401);
    expect(findLatestOrders).not.toHaveBeenCalled();
  });

  it('returns 413 for oversized bodies', async (): Promise<void> => {
    const response = await POST(signed(body({ orderNumber: 'a'.repeat(3000) })));
    expect(response.status).toBe(413);
    expect(findLatestOrders).not.toHaveBeenCalled();
  });

  it('returns 400 for a signed but invalid body', async (): Promise<void> => {
    for (const raw of [body({ phone: '+573001112233' }), body({ orderNumber: 'a\nb' })]) {
      const response = await POST(signed(raw));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid_request' });
    }
    expect(findLatestOrders).not.toHaveBeenCalled();
  });

  it('returns orders with no-store on success', async (): Promise<void> => {
    const orders = [{ orderNumber: 'A1', status: 'paid', updatedAt: '2026-10-01T10:00:00.000Z' }];
    findLatestOrders.mockResolvedValue(orders);
    const response = await POST(signed(body({ orderNumber: '#A1' })));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ orders });
    expect(findLatestOrders).toHaveBeenCalledWith({
      tenantId: TENANT,
      phone: '573001112233',
      orderNumber: '#A1',
    });
  });

  it('returns 500 without logging the phone when the port fails', async (): Promise<void> => {
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    findLatestOrders.mockRejectedValue(new Error('db 573001112233'));
    const response = await POST(signed(body()));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'unavailable' });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('573001112233');
  });
});
