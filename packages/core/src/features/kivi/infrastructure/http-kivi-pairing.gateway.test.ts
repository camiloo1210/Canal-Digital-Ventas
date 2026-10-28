import { describe, expect, it, vi } from 'vitest';
import { HttpKiviPairingGateway } from '@/kivi/infrastructure/http-kivi-pairing.gateway';
import { KiviPairingException } from '@/kivi/application/exceptions/kivi-pairing.exception';
import { KiviBaseUrl } from '@/kivi/domain/value-objects/kivi-base-url.vo';

const TOKEN = 'kc_' + 'Z'.repeat(43);
const CODE = 'kvp_' + 'c'.repeat(32);
const CONNECTION = '22222222-2222-4222-8222-222222222222';
const request = {
  code: CODE,
  externalTenantId: '11111111-1111-4111-8111-111111111111',
  name: 'Tienda Demo',
};

interface Call {
  url: string;
  init: RequestInit;
}

function build(
  respond: (call: Call) => Response | Promise<Response>,
  options: { timeoutMs?: number; resolve?: () => Promise<string[]> } = {},
): { gateway: HttpKiviPairingGateway; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (input: URL | string, init?: RequestInit): Promise<Response> => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  const gateway = new HttpKiviPairingGateway({
    baseUrl: KiviBaseUrl.from('https://api.kivi.example'),
    fetch: fetchImpl,
    timeoutMs: options.timeoutMs ?? 50,
    resolveAddresses: options.resolve ?? (async (): Promise<string[]> => ['93.184.216.34']),
  });
  return { gateway, calls };
}

const json = (status: number, body: unknown = {}): Response =>
  new Response(JSON.stringify(body), { status });

async function failureOf(promise: Promise<unknown>): Promise<KiviPairingException> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof KiviPairingException) return error;
    throw error;
  }
  return expect.unreachable('Expected a KiviPairingException');
}

describe('HttpKiviPairingGateway.exchange', (): void => {
  it('posts the code, tenant id and name without credentials and parses the result', async (): Promise<void> => {
    const { gateway, calls } = build((): Response =>
      json(201, {
        connection_id: CONNECTION,
        token: TOKEN,
        scopes: ['catalog:write'],
        expires_at: '2027-01-01T00:00:00Z',
      }),
    );
    const result = await gateway.exchange(request);
    expect(result).toEqual({
      connectionId: CONNECTION,
      token: TOKEN,
      scopes: ['catalog:write'],
      expiresAt: '2027-01-01T00:00:00Z',
    });
    expect(calls[0].url).toBe('https://api.kivi.example/api/v1/connections/pairing/exchange');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.redirect).toBe('error');
    expect(calls[0].init.credentials).toBe('omit');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      code: CODE,
      external_tenant_id: request.externalTenantId,
      name: request.name,
    });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('classifies failures without leaking code, token, URL or body', async (): Promise<void> => {
    const cases: Array<[Response, string]> = [
      [json(400, { detail: 'invalid_or_expired_code' }), 'invalid_or_expired_code'],
      [json(429, { detail: 'slow down' }), 'rate_limited'],
      [json(500, { detail: 'boom ' + TOKEN }), 'unavailable'],
      [json(502), 'unavailable'],
      [json(404), 'unavailable'],
    ];
    for (const [response, expected] of cases) {
      const { gateway } = build((): Response => response.clone());
      const error = await failureOf(gateway.exchange(request));
      expect(error.failure).toBe(expected);
      const text = error.message + String(error.stack);
      for (const secret of [CODE, TOKEN, 'api.kivi.example']) {
        expect(text).not.toContain(secret);
      }
    }
  });

  it('treats network errors, timeouts and malformed success bodies as unavailable', async (): Promise<void> => {
    const net = build((): Promise<Response> => Promise.reject(new Error('ECONNRESET ' + CODE)));
    expect((await failureOf(net.gateway.exchange(request))).failure).toBe('unavailable');
    const slow = build(
      (call): Promise<Response> =>
        new Promise((_resolve, reject): void => {
          call.init.signal?.addEventListener('abort', (): void => reject(new Error('aborted')));
        }),
      { timeoutMs: 10 },
    );
    expect((await failureOf(slow.gateway.exchange(request))).failure).toBe('unavailable');
    for (const body of [
      {},
      { connection_id: 'nope', token: TOKEN },
      { connection_id: CONNECTION, token: 'not-a-token' },
    ]) {
      const bad = build((): Response => json(201, body));
      expect((await failureOf(bad.gateway.exchange(request))).failure).toBe('unavailable');
    }
  });

  it('refuses hosts that resolve to private addresses', async (): Promise<void> => {
    const { gateway, calls } = build((): Response => json(201, {}), {
      resolve: async (): Promise<string[]> => ['10.0.0.5'],
    });
    expect((await failureOf(gateway.exchange(request))).failure).toBe('unavailable');
    expect(calls).toHaveLength(0);
  });
});

describe('HttpKiviPairingGateway.revokeSelf', (): void => {
  const target = { baseUrl: 'https://api.kivi.example', connectionId: CONNECTION, token: TOKEN };

  it('posts revoke-self with the bearer token and accepts 204', async (): Promise<void> => {
    const { gateway, calls } = build((): Response => new Response(null, { status: 204 }));
    await gateway.revokeSelf(target);
    expect(calls[0].url).toBe(
      `https://api.kivi.example/api/v1/connections/${CONNECTION}/revoke-self`,
    );
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.redirect).toBe('error');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('classifies failures without the token', async (): Promise<void> => {
    const { gateway } = build((): Response => json(401, { detail: TOKEN }));
    const error = await failureOf(gateway.revokeSelf(target));
    expect(error.failure).toBe('invalid_or_expired_code');
    expect(error.message + String(error.stack)).not.toContain(TOKEN);
    const down = build((): Response => json(503));
    expect((await failureOf(down.gateway.revokeSelf(target))).failure).toBe('unavailable');
  });

  it('rejects an unsafe stored base URL', async (): Promise<void> => {
    const { gateway, calls } = build((): Response => new Response(null, { status: 204 }));
    const error = await failureOf(gateway.revokeSelf({ ...target, baseUrl: 'http://10.0.0.1' }));
    expect(error.failure).toBe('unavailable');
    expect(calls).toHaveLength(0);
  });
});

describe('pairing diagnostics', (): void => {
  it('correlates timeouts without logging credentials or vendor messages', async (): Promise<void> => {
    const log = vi.spyOn(console, 'warn').mockImplementation((): void => undefined);
    try {
      const { gateway, calls } = build(
        (call): Promise<Response> =>
          new Promise((_resolve, reject): void => {
            call.init.signal?.addEventListener('abort', (): void =>
              reject(new Error(CODE + TOKEN)),
            );
          }),
        { timeoutMs: 5 },
      );
      expect((await failureOf(gateway.exchange(request))).failure).toBe('unavailable');
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers['X-Request-ID']).toMatch(/^[0-9a-f-]{36}$/);
      expect(log).toHaveBeenCalledWith(
        '[Kivi] Request failed',
        expect.objectContaining({
          requestId: headers['X-Request-ID'],
          outcome: 'timeout',
          elapsedMs: expect.any(Number),
        }),
      );
      const output = JSON.stringify(log.mock.calls);
      for (const secret of [
        CODE,
        TOKEN,
        request.externalTenantId,
        request.name,
        'api.kivi.example',
      ]) {
        expect(output).not.toContain(secret);
      }
    } finally {
      log.mockRestore();
    }
  });

  it('records HTTP status without response secrets', async (): Promise<void> => {
    const log = vi.spyOn(console, 'info').mockImplementation((): void => undefined);
    try {
      const { gateway } = build((): Response => json(503, { detail: TOKEN }));
      await failureOf(gateway.exchange(request));
      expect(log).toHaveBeenCalledWith(
        '[Kivi] Response received',
        expect.objectContaining({
          status: 503,
          elapsedMs: expect.any(Number),
          requestId: expect.any(String),
        }),
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
    } finally {
      log.mockRestore();
    }
  });
});
