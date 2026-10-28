import { describe, expect, it } from 'vitest';
import { EnvKiviSecretResolver } from '@/kivi/infrastructure/env-kivi-secret.resolver';
import { KiviOutboxEventPublisher } from '@/kivi/infrastructure/kivi-outbox-event.publisher';
import {
  loadKiviSyncWorkerConfig,
  type KiviSyncWorkerConfig,
} from '@/kivi/infrastructure/kivi-sync-worker-config';
import { PostgresKiviSyncStoreAdapter } from '@/kivi/infrastructure/postgres-kivi-sync-store.adapter';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';

class KiviPortProbeException extends Error {}

const TOKEN = 'kc_' + 'Q'.repeat(43);

describe('EnvKiviSecretResolver', (): void => {
  it('resolves only well-formed credentials for KIVI_CONNECTION_TOKEN_* names', (): void => {
    const resolver = new EnvKiviSecretResolver({
      KIVI_CONNECTION_TOKEN_A: TOKEN,
      KIVI_CONNECTION_TOKEN_BAD: 'not-a-token',
      DATABASE_URL: 'postgres://secret',
    });
    expect(resolver.resolve('KIVI_CONNECTION_TOKEN_A')).toBe(TOKEN);
    expect(resolver.resolve('KIVI_CONNECTION_TOKEN_BAD')).toBeNull();
    expect(resolver.resolve('KIVI_CONNECTION_TOKEN_MISSING')).toBeNull();
    expect(resolver.resolve('DATABASE_URL')).toBeNull();
  });
});

describe('KiviOutboxEventPublisher', (): void => {
  const event: IntegrationEvent = {
    messageId: 'm',
    tenantId: 't',
    aggregateType: 'Product',
    aggregateId: 'p',
    eventType: 'ProductCreatedEvent',
    occurredAt: '2026-10-27T00:00:00Z',
    payload: {},
  };

  it('resolves only after the use case finished delivering', async (): Promise<void> => {
    const seen: string[] = [];
    const publisher = new KiviOutboxEventPublisher({
      execute: async (e: IntegrationEvent): Promise<void> => {
        seen.push(e.aggregateId);
      },
    });
    await publisher.publish(event);
    expect(seen).toEqual(['p']);
  });

  it('propagates failures so the event is not completed', async (): Promise<void> => {
    const publisher = new KiviOutboxEventPublisher({
      execute: async (): Promise<void> => {
        throw new KiviPortProbeException('boom');
      },
    });
    await expect(publisher.publish(event)).rejects.toThrow('boom');
  });
});

describe('loadKiviSyncWorkerConfig', (): void => {
  const base = {
    KIVI_SYNC_DATABASE_URL: 'postgresql://u:p@db.example:5432/postgres',
    KIVI_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  };

  it('fails closed without a valid token encryption key', (): void => {
    const withoutKey = { KIVI_SYNC_DATABASE_URL: base.KIVI_SYNC_DATABASE_URL };
    expect((): KiviSyncWorkerConfig => loadKiviSyncWorkerConfig(withoutKey)).toThrow(
      'KIVI_TOKEN_ENCRYPTION_KEY',
    );
    expect((): KiviSyncWorkerConfig =>
      loadKiviSyncWorkerConfig({ ...base, KIVI_TOKEN_ENCRYPTION_KEY: 'short' }),
    ).toThrow('KIVI_TOKEN_ENCRYPTION_KEY');
  });

  it('applies safe defaults', (): void => {
    expect(loadKiviSyncWorkerConfig(base)).toMatchObject({
      pollIntervalMs: 1000,
      reconcileIntervalMs: 6 * 3_600_000,
      allowLocalDevelopment: false,
    });
  });

  it('rejects a missing/invalid database URL without echoing it', (): void => {
    expect((): KiviSyncWorkerConfig =>
      loadKiviSyncWorkerConfig({ KIVI_TOKEN_ENCRYPTION_KEY: base.KIVI_TOKEN_ENCRYPTION_KEY }),
    ).toThrow('KIVI_SYNC_DATABASE_URL');
    expect((): KiviSyncWorkerConfig =>
      loadKiviSyncWorkerConfig({ ...base, KIVI_SYNC_DATABASE_URL: 'http://x:secret@y' }),
    ).toThrow(/^((?!secret).)*$/s);
  });

  it('only allows local development targets outside production', (): void => {
    expect(
      loadKiviSyncWorkerConfig({
        ...base,
        KIVI_ALLOW_LOCAL_DEVELOPMENT: 'true',
        NODE_ENV: 'development',
      }).allowLocalDevelopment,
    ).toBe(true);
    expect((): KiviSyncWorkerConfig =>
      loadKiviSyncWorkerConfig({
        ...base,
        KIVI_ALLOW_LOCAL_DEVELOPMENT: 'true',
        NODE_ENV: 'production',
      }),
    ).toThrow('KIVI_ALLOW_LOCAL_DEVELOPMENT');
  });

  it('bounds the reconcile interval', (): void => {
    expect((): KiviSyncWorkerConfig =>
      loadKiviSyncWorkerConfig({ ...base, KIVI_RECONCILE_INTERVAL_MS: '10' }),
    ).toThrow('KIVI_RECONCILE_INTERVAL_MS');
  });
});

describe('PostgresKiviSyncStoreAdapter', (): void => {
  it('maps worker RPC rows to domain objects using only the narrow functions', async (): Promise<void> => {
    const queries: string[] = [];
    const sql = ((strings: TemplateStringsArray): Promise<unknown[]> => {
      queries.push(strings.join('?'));
      if (queries.length === 1) {
        return Promise.resolve([
          {
            tenant_id: '11111111-1111-4111-8111-111111111111',
            base_url: 'https://api.kivi.example',
            connection_id: '22222222-2222-4222-8222-222222222222',
            secret_ref: null,
            token_ciphertext: 'v1.aaaa.bbbb',
            token_key_version: 1,
            status: 'needs_reconcile',
            last_reconciled_at: new Date('2026-10-01T00:00:00Z'),
          },
        ]);
      }
      return Promise.resolve([
        {
          id: 'p1',
          tenant_id: 't',
          name: 'Cafe',
          price_cents: 350,
          description: null,
          stock: 2,
          status: 'active',
          version: 3,
        },
      ]);
    }) as never;
    const store = new PostgresKiviSyncStoreAdapter(sql, { allowLocalDevelopment: false });
    const connection = await store.findConnection('11111111-1111-4111-8111-111111111111');
    expect(connection?.getStatus()).toBe('needs_reconcile');
    const found = await store.findProduct('t', 'p1');
    expect(found).toMatchObject({ id: 'p1', priceCents: 350, version: 3, status: 'active' });
    expect(connection?.getSecretRef()).toBeNull();
    expect(connection?.getEncryptedToken()).toEqual({ ciphertext: 'v1.aaaa.bbbb', keyVersion: 1 });
    expect(queries[0]).toContain('core.kivi_sync_get_connection_v3');
    expect(queries[1]).toContain('core.kivi_sync_get_product');
  });
});
