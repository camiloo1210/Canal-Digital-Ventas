import { describe, expect, it } from 'vitest';
import { HttpKiviToolsGateway } from '@/kivi/infrastructure/http-kivi-tools.gateway';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import { KIVI_TOOL_CATALOG } from '@/kivi/application/kivi-tool-catalog';

const TOKEN = 'kc_' + 'Q'.repeat(43);
const KEY = 'a'.repeat(64);
const CONNECTION = '22222222-2222-4222-8222-222222222222';
const target = { baseUrl: 'https://api.kivi.example', connectionId: CONNECTION, token: TOKEN };
const registration = {
  baseUrl: 'https://shop.example.com/api/kivi/tools',
  key: KEY,
  tools: KIVI_TOOL_CATALOG,
};

interface Call {
  url: string;
  init: RequestInit;
}

function build(respond: () => Response): { gateway: HttpKiviToolsGateway; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (input: URL | string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    return respond();
  }) as typeof fetch;
  return {
    gateway: new HttpKiviToolsGateway({
      fetch: fetchImpl,
      timeoutMs: 50,
      resolveAddresses: async (): Promise<string[]> => ['93.184.216.34'],
    }),
    calls,
  };
}

describe('HttpKiviToolsGateway.registerTools', (): void => {
  it('PUTs the body with bearer auth and parses the result', async (): Promise<void> => {
    const { gateway, calls } = build(
      (): Response =>
        new Response(JSON.stringify({ registered: ['get_product_details'], removed: [] }), {
          status: 200,
        }),
    );
    const result = await gateway.registerTools(target, registration);
    expect(result).toEqual({ available: true, registered: ['get_product_details'], removed: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://api.kivi.example/api/v1/connections/${CONNECTION}/tools`);
    expect(calls[0].init.method).toBe('PUT');
    expect(calls[0].init.redirect).toBe('error');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      base_url: registration.baseUrl,
      key: KEY,
      tools: JSON.parse(JSON.stringify(KIVI_TOOL_CATALOG)),
    });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it.each([403, 404])(
    'treats %i as "not available" without throwing',
    async (status: number): Promise<void> => {
      const { gateway } = build((): Response => new Response('{}', { status }));
      await expect(gateway.registerTools(target, registration)).resolves.toEqual({
        available: false,
        registered: [],
        removed: [],
      });
    },
  );

  it('throws a classified error for other failures, never exposing the token or key', async (): Promise<void> => {
    const { gateway } = build((): Response => new Response(`${TOKEN} ${KEY}`, { status: 500 }));
    const error = await gateway
      .registerTools(target, registration)
      .catch((e: unknown): unknown => e);
    expect(error).toBeInstanceOf(KiviGatewayException);
    const text = `${(error as Error).message} ${JSON.stringify(error)}`;
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(KEY);
    expect((error as KiviGatewayException).failure).toBe('transient');
  });

  it('refuses private hosts (SSRF guard)', async (): Promise<void> => {
    const gateway = new HttpKiviToolsGateway({
      fetch: (async (): Promise<Response> => new Response('{}')) as typeof fetch,
      resolveAddresses: async (): Promise<string[]> => ['10.0.0.1'],
    });
    await expect(gateway.registerTools(target, registration)).rejects.toBeInstanceOf(
      KiviGatewayException,
    );
  });
});
