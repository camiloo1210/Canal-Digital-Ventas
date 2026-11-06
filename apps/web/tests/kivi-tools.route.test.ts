import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/kivi/tools/[tool]/route';
import { getKiviProductLookupReadRepository } from '@/features/kivi/di/kivi.di';
import { signKiviTools } from '@canaldigital/packages/core';

vi.mock('@/features/kivi/di/kivi.di', (): object => ({
  getKiviProductLookupReadRepository: vi.fn(),
}));

const MASTER = Buffer.alloc(32, 5);
const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
const findProducts = vi.fn();

function body(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    tenantId: TENANT,
    tool: 'get_product_details',
    arguments: { query: 'cafe' },
    ...overrides,
  });
}

function signed(
  raw: string,
  timestamp: string = String(Math.floor(Date.now() / 1000)),
  signTenant: string = TENANT,
): Request {
  return new Request('http://localhost/api/kivi/tools/get_product_details', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Kivi-Timestamp': timestamp,
      'X-Kivi-Signature': signKiviTools(MASTER, signTenant, timestamp, raw),
    },
    body: raw,
  });
}

function ctx(tool: string = 'get_product_details'): { params: Promise<{ tool: string }> } {
  return { params: Promise.resolve({ tool }) };
}

describe('POST /api/kivi/tools/[tool]', (): void => {
  beforeEach((): void => {
    vi.stubEnv('KIVI_TOKEN_ENCRYPTION_KEY', MASTER.toString('base64'));
    findProducts.mockReset().mockResolvedValue([]);
    vi.mocked(getKiviProductLookupReadRepository).mockReturnValue({ findProducts });
  });
  afterEach((): void => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns 503 when the master key is unusable', async (): Promise<void> => {
    vi.stubEnv('KIVI_TOKEN_ENCRYPTION_KEY', 'short');
    expect((await POST(signed(body()), ctx())).status).toBe(503);
    expect(findProducts).not.toHaveBeenCalled();
  });

  it('returns the same 401 body without touching the port for every auth failure', async (): Promise<void> => {
    const raw = body();
    const now = Math.floor(Date.now() / 1000);
    const tampered = signed(raw);
    const requests = [
      signed(raw, String(now - 1000)),
      new Request('http://localhost/x', { method: 'POST', body: raw }),
      new Request('http://localhost/x', {
        method: 'POST',
        headers: tampered.headers,
        body: body({ arguments: { query: 'otro' } }),
      }),
      // Signed for another tenant while claiming this tenant.
      signed(raw, String(now), OTHER_TENANT),
      // Valid for the other tenant's body but the tool route is unknown: still auth first.
      signed('not json'),
    ];
    for (const request of requests) {
      const response = await POST(request, ctx());
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
    }
    expect((await POST(signed(raw), ctx('nope'))).status).toBe(404);
    expect(findProducts).not.toHaveBeenCalled();
  });

  it('cancels an oversized chunked body before reading the remaining stream', async (): Promise<void> => {
    let pulls = 0;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller: ReadableStreamDefaultController<Uint8Array>): void {
          pulls += 1;
          controller.enqueue(new Uint8Array(5000));
          if (pulls === 3) controller.close();
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    const options: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      body: stream,
      duplex: 'half',
    };
    const request = new Request('https://app.test/api/kivi/test', options);
    const response = await POST(request, ctx());
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(pulls).toBe(1);
  });

  it('returns 413 for oversized bodies', async (): Promise<void> => {
    const raw = body({ arguments: { query: 'x'.repeat(5000) } });
    expect((await POST(signed(raw), ctx())).status).toBe(413);
    expect(findProducts).not.toHaveBeenCalled();
  });

  it('returns 404 unknown_tool for an authenticated unknown tool', async (): Promise<void> => {
    const response = await POST(signed(body({ tool: 'other' })), ctx('other'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'unknown_tool' });
    expect(findProducts).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid bodies or arguments', async (): Promise<void> => {
    const cases = [
      body({ arguments: {} }),
      body({ arguments: { query: '' } }),
      body({ arguments: { query: '   ' } }),
      body({ arguments: { query: 'x'.repeat(101) } }),
      body({ arguments: { query: 42 } }),
      body({ arguments: { query: 'a\u0000b' } }),
      body({ tool: 'something_else' }),
      body({ tenantId: 'not-a-uuid' }),
    ];
    for (const raw of cases) {
      const tenant = raw.includes('not-a-uuid') ? 'not-a-uuid' : TENANT;
      const response = await POST(signed(raw, undefined, tenant), ctx());
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid_request' });
    }
    expect(findProducts).not.toHaveBeenCalled();
  });

  it('returns 200 with products, using the verified tenant, with no-store', async (): Promise<void> => {
    const products = [
      {
        name: 'Cafe',
        sku: 'C-1',
        category: 'Bebidas',
        price: '3.50',
        currency: 'USD',
        wholesale_price: null,
        wholesale_min_quantity: null,
        availability: 'available',
      },
    ];
    findProducts.mockResolvedValue(products);
    const response = await POST(signed(body({ arguments: { query: ' cafe ' } })), ctx());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ products });
    expect(findProducts).toHaveBeenCalledWith({ tenantId: TENANT, query: 'cafe' });
  });

  it('returns 500 without leaking details when the port fails', async (): Promise<void> => {
    findProducts.mockRejectedValue(new Error('db password'));
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => {});
    const response = await POST(signed(body()), ctx());
    expect(response.status).toBe(500);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('db password');
  });
});
