import { describe, expect, it } from 'vitest';
import { HttpKiviCatalogGateway } from '@/kivi/infrastructure/http-kivi-catalog.gateway';
import { isPrivateAddress } from '@/kivi/infrastructure/private-address';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import type {
  KiviProductPayload,
  KiviTarget,
} from '@/kivi/application/ports/out/kivi-catalog-gateway.port';

class KiviFetchProbeException extends TypeError {}

const TOKEN = 'kc_' + 'Z'.repeat(43);
const target: KiviTarget = {
  baseUrl: 'https://api.kivi.example',
  connectionId: '22222222-2222-4222-8222-222222222222',
  token: TOKEN,
};
const payload: KiviProductPayload = {
  version: 3,
  name: 'Cafe',
  price: '3.50',
  currency: 'USD',
  description: null,
  is_available: true,
  is_orderable: true,
};

interface Call {
  url: string;
  init: RequestInit;
}

function gatewayWith(
  respond: (call: Call) => Response | Promise<Response>,
  options: { timeoutMs?: number; resolve?: (host: string) => Promise<string[]> } = {},
): { gateway: HttpKiviCatalogGateway; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (input: URL | string, init?: RequestInit): Promise<Response> => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  const gateway = new HttpKiviCatalogGateway({
    fetch: fetchImpl,
    timeoutMs: options.timeoutMs ?? 50,
    resolveAddresses: options.resolve ?? (async (): Promise<string[]> => ['93.184.216.34']),
  });
  return { gateway, calls };
}

const json = (status: number, body: unknown = {}, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers });

async function failureOf(promise: Promise<unknown>): Promise<KiviGatewayException> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof KiviGatewayException) return error;
    throw error;
  }
  return expect.unreachable('Expected a KiviGatewayException');
}

describe('HttpKiviCatalogGateway', (): void => {
  it.each([
    null,
    [],
    'invalid',
    {},
    { external_id: 'p1', product_id: 'k1', version: 'invalid', deleted: false },
    { external_id: 'p1', product_id: 'k1', version: 0, deleted: false },
    { external_id: 'p1', product_id: 'k1', version: 1.5, deleted: false },
    { external_id: 'another', product_id: 'k1', version: 1, deleted: false },
  ])(
    'rejects malformed identity response %j with a typed gateway failure',
    async (body: unknown): Promise<void> => {
      const { gateway } = gatewayWith((): Response => json(200, body));
      await expect(gateway.getIdentity(target, 'p1')).rejects.toBeInstanceOf(KiviGatewayException);
    },
  );

  it('translates a missing identity response body instead of leaking a TypeError', async (): Promise<void> => {
    const { gateway } = gatewayWith((): Response => new Response(null, { status: 204 }));
    await expect(gateway.getIdentity(target, 'p1')).rejects.toBeInstanceOf(KiviGatewayException);
  });

  it('rejects a partially malformed product list instead of silently dropping entries', async (): Promise<void> => {
    const { gateway } = gatewayWith((): Response => json(200, [{ id: 'k1' }, { id: 2 }]));
    await expect(gateway.listKiviProductIds(target)).rejects.toBeInstanceOf(KiviGatewayException);
  });
  it('PUTs the documented product contract with bearer auth, no redirects and no cookies', async (): Promise<void> => {
    const { gateway, calls } = gatewayWith((): Response => json(200, { external_id: 'p1' }));
    await gateway.putProduct(target, 'p1', payload);
    expect(calls[0].url).toBe(
      'https://api.kivi.example/api/v1/connections/22222222-2222-4222-8222-222222222222/catalog/products/p1',
    );
    expect(calls[0].init.method).toBe('PUT');
    expect(calls[0].init.redirect).toBe('error');
    expect(calls[0].init.credentials).toBe('omit');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(String(calls[0].init.body))).toEqual(payload);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it('DELETEs with the version query and treats 2xx as accepted', async (): Promise<void> => {
    const { gateway, calls } = gatewayWith((): Response => json(200));
    await gateway.deleteProduct(target, 'p1', 7);
    expect(calls[0].init.method).toBe('DELETE');
    expect(calls[0].url.endsWith('/catalog/products/p1?version=7')).toBe(true);
  });

  it('percent-encodes and validates external ids', async (): Promise<void> => {
    const { gateway } = gatewayWith((): Response => json(200));
    const error = await failureOf(gateway.putProduct(target, '../admin', payload));
    expect(error.failure).toBe('rejected');
  });

  it('reads identity, returning null for 404', async (): Promise<void> => {
    const ok = gatewayWith((): Response =>
      json(200, { external_id: 'p1', product_id: 'k1', version: 4, deleted: false }),
    );
    expect(await ok.gateway.getIdentity(target, 'p1')).toEqual({
      externalId: 'p1',
      kiviProductId: 'k1',
      version: 4,
      deleted: false,
    });
    const missing = gatewayWith((): Response => json(404));
    expect(await missing.gateway.getIdentity(target, 'p1')).toBeNull();
  });

  it('lists Kivi product ids', async (): Promise<void> => {
    const { gateway } = gatewayWith((): Response => json(200, [{ id: 'k1' }, { id: 'k2' }]));
    expect(await gateway.listKiviProductIds(target)).toEqual(['k1', 'k2']);
  });

  it.each([
    [409, 'conflict'],
    [429, 'rate_limited'],
    [500, 'transient'],
    [503, 'transient'],
    [408, 'transient'],
    [401, 'rejected'],
    [403, 'rejected'],
    [422, 'rejected'],
    [404, 'rejected'],
  ] as const)('maps HTTP %i to %s', async (status: number, expected: string): Promise<void> => {
    const { gateway } = gatewayWith((): Response =>
      json(status, { detail: 'secret echo ' + TOKEN }),
    );
    const error = await failureOf(gateway.putProduct(target, 'p1', payload));
    expect(error.failure).toBe(expected);
    expect(error.status).toBe(status);
    expect(error.message).not.toContain(TOKEN);
    expect(JSON.stringify(error)).not.toContain(TOKEN);
  });

  it('honours Retry-After seconds on 429 (capped)', async (): Promise<void> => {
    const a = gatewayWith((): Response => json(429, {}, { 'Retry-After': '12' }));
    expect((await failureOf(a.gateway.putProduct(target, 'p1', payload))).retryAfterMs).toBe(12000);
    const b = gatewayWith((): Response => json(429, {}, { 'Retry-After': '999999' }));
    expect((await failureOf(b.gateway.putProduct(target, 'p1', payload))).retryAfterMs).toBe(
      120000,
    );
    const c = gatewayWith((): Response => json(429));
    expect((await failureOf(c.gateway.putProduct(target, 'p1', payload))).retryAfterMs).toBeNull();
  });

  it('aborts after a finite timeout and reports a transient failure', async (): Promise<void> => {
    const { gateway } = gatewayWith(
      (call): Promise<Response> =>
        new Promise<Response>((_resolve, reject): void => {
          (call.init.signal as AbortSignal).addEventListener('abort', (): void =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
      { timeoutMs: 20 },
    );
    const error = await failureOf(gateway.putProduct(target, 'p1', payload));
    expect(error.failure).toBe('transient');
    expect(error.status).toBe(0);
  });

  it('treats network errors and redirects (fetch redirect:error) as transient without leaking details', async (): Promise<void> => {
    const { gateway } = gatewayWith((): never => {
      throw new KiviFetchProbeException('fetch failed https://evil.example ' + TOKEN);
    });
    const error = await failureOf(gateway.putProduct(target, 'p1', payload));
    expect(error.failure).toBe('transient');
    expect(error.message).not.toContain('evil');
    expect(error.message).not.toContain(TOKEN);
  });

  it('refuses to connect when the host resolves to a private address (DNS rebinding guard)', async (): Promise<void> => {
    const { gateway, calls } = gatewayWith((): Response => json(200), {
      resolve: async (): Promise<string[]> => ['10.0.0.8'],
    });
    const error = await failureOf(gateway.putProduct(target, 'p1', payload));
    expect(error.failure).toBe('rejected');
    expect(calls).toEqual([]);
  });

  it('refuses unsafe base URLs at call time', async (): Promise<void> => {
    const { gateway, calls } = gatewayWith((): Response => json(200));
    const error = await failureOf(
      gateway.putProduct({ ...target, baseUrl: 'https://169.254.169.254' }, 'p1', payload),
    );
    expect(error.failure).toBe('rejected');
    expect(calls).toEqual([]);
  });
});

describe('isPrivateAddress', (): void => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '169.254.169.254',
    '0.0.0.0',
    '100.64.0.1',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
  ])('flags %s', (ip: string): void => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700:4700::1111'])(
    'allows public %s',
    (ip: string): void => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );
});
