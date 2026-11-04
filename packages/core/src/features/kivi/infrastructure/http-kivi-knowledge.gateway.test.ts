import { describe, expect, it } from 'vitest';
import { HttpKiviKnowledgeGateway } from '@/kivi/infrastructure/http-kivi-knowledge.gateway';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';

const target: KiviTarget = {
  baseUrl: 'https://api.kivi.example',
  connectionId: '22222222-2222-4222-8222-222222222222',
  token: 'kc_' + 'Z'.repeat(43),
};

interface Call {
  url: string;
  init: RequestInit;
}

function gatewayWith(
  body: unknown,
  status: number = 200,
): { gateway: HttpKiviKnowledgeGateway; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (input: URL | string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return {
    calls,
    gateway: new HttpKiviKnowledgeGateway({
      fetch: fetchImpl,
      resolveAddresses: async (): Promise<string[]> => ['93.184.216.34'],
    }),
  };
}

const row = {
  id: 'a',
  kind: 'document',
  external_id: 'factura.ab12cd34',
  version: 2,
  status: 'indexed',
  attempts: 0,
  last_error: 'internal detail that must not surface',
  updated_at: '2026-11-03T10:00:00Z',
  indexed_at: '2026-11-03T10:01:00Z',
  expires_at: null,
};

describe('HttpKiviKnowledgeGateway', (): void => {
  it('lists resources and drops failure details', async (): Promise<void> => {
    const { gateway, calls } = gatewayWith([row]);
    const [resource] = await gateway.list(target);
    expect(calls[0].url).toBe(
      `${target.baseUrl}/api/v1/connections/${target.connectionId}/resources?limit=100`,
    );
    expect(resource).toEqual({
      kind: 'document',
      externalId: 'factura.ab12cd34',
      version: 2,
      status: 'indexed',
      updatedAt: '2026-11-03T10:00:00Z',
      indexedAt: '2026-11-03T10:01:00Z',
    });
    expect(JSON.stringify(resource)).not.toContain('internal detail');
  });

  it('puts a versioned document with only title and content', async (): Promise<void> => {
    const { gateway, calls } = gatewayWith({ ...row, status: 'pending' }, 202);
    await gateway.put(target, 'document', 'factura.ab12cd34', 3, { title: 'T', content: 'C' });
    expect(calls[0].init.method).toBe('PUT');
    expect(calls[0].url).toContain('/resources/document/factura.ab12cd34');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      version: 3,
      title: 'T',
      content: 'C',
    });
  });

  it('deletes with the version in the query and retries via POST', async (): Promise<void> => {
    const { gateway, calls } = gatewayWith({ ...row, status: 'deleted' }, 202);
    await gateway.remove(target, 'document', 'factura.ab12cd34', 3);
    await gateway.retry(target, 'document', 'factura.ab12cd34');
    expect(calls[0].init.method).toBe('DELETE');
    expect(calls[0].url).toContain('/resources/document/factura.ab12cd34?version=3');
    expect(calls[1].init.method).toBe('POST');
    expect(calls[1].url).toContain('/factura.ab12cd34/retry');
  });

  it.each(['..', '.', 'a/b', 'a b', ''])(
    'refuses the unsafe id %j without any request',
    async (id): Promise<void> => {
      const { gateway, calls } = gatewayWith(row);
      await expect(gateway.retry(target, 'document', id)).rejects.toMatchObject({
        name: 'KiviGatewayException',
      });
      expect(calls).toHaveLength(0);
    },
  );

  it('treats a malformed response as a transient failure', async (): Promise<void> => {
    const { gateway } = gatewayWith([{ ...row, status: 'weird' }]);
    await expect(gateway.list(target)).rejects.toMatchObject({ name: 'KiviGatewayException' });
  });
});
