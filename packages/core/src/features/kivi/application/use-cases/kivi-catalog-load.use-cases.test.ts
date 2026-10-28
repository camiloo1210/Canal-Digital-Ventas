import { describe, expect, it } from 'vitest';
import { InitialLoadKiviCatalogUseCase } from '@/kivi/application/use-cases/initial-load-kivi-catalog.use-case';
import { ReconcileKiviCatalogUseCase } from '@/kivi/application/use-cases/reconcile-kivi-catalog.use-case';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import { KiviDeliveryException } from '@/kivi/application/exceptions/kivi-delivery.exception';
import {
  MemorySyncStore,
  RecordingGateway,
  TENANT,
  connection,
  product,
  secrets,
} from '@/kivi/application/kivi-test-doubles';

const NOW = new Date('2026-10-27T12:00:00Z');

describe('InitialLoadKiviCatalogUseCase', (): void => {
  it('sends every live product with external id and version, across pages, skipping archived ones', async (): Promise<void> => {
    const products = Array.from({ length: 5 }, (_, i): ReturnType<typeof product> =>
      product(`p${i}`, { version: i }),
    );
    products.push(product('p9', { status: 'archived' }));
    const store = new MemorySyncStore(connection('pending'), products);
    const gateway = new RecordingGateway();
    const result = await new InitialLoadKiviCatalogUseCase(store, gateway, secrets, 2).execute(
      TENANT,
      NOW,
    );
    expect(gateway.puts.map((p): string => p.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(gateway.puts.map((p): number => p.payload.version)).toEqual([1, 2, 3, 4, 5]);
    expect(gateway.deletes).toEqual([]);
    expect(result).toEqual({ sent: 5, conflicts: 0 });
    expect(store.saved.at(-1)?.getStatus()).toBe('active');
    expect(store.saved.at(-1)?.getLastReconciledAt()).toEqual(NOW);
  });

  it('flags needs-reconcile when Kivi reports a conflict but keeps loading', async (): Promise<void> => {
    const store = new MemorySyncStore(connection('pending'), [product('a'), product('b')]);
    const gateway = new RecordingGateway();
    const original = gateway.putProduct.bind(gateway);
    gateway.putProduct = async (t, id, payload): Promise<void> => {
      if (id === 'a') throw new KiviGatewayException('conflict', 409);
      await original(t, id, payload);
    };
    const result = await new InitialLoadKiviCatalogUseCase(store, gateway, secrets, 10).execute(
      TENANT,
      NOW,
    );
    expect(result).toEqual({ sent: 1, conflicts: 1 });
    expect(store.saved.at(-1)?.getStatus()).toBe('needs_reconcile');
  });

  it('aborts retryably on throttling without marking the link as loaded', async (): Promise<void> => {
    const store = new MemorySyncStore(connection('pending'), [product('a')]);
    const gateway = new RecordingGateway();
    gateway.failWith = new KiviGatewayException('rate_limited', 429, 3000);
    await expect(
      new InitialLoadKiviCatalogUseCase(store, gateway, secrets, 10).execute(TENANT, NOW),
    ).rejects.toBeInstanceOf(KiviDeliveryException);
    expect(store.saved).toEqual([]);
  });
});

describe('ReconcileKiviCatalogUseCase', (): void => {
  const run = async (
    products: ReturnType<typeof product>[],
    gateway: RecordingGateway,
  ): Promise<{
    store: MemorySyncStore;
    result: Awaited<ReturnType<ReconcileKiviCatalogUseCase['execute']>>;
  }> => {
    const store = new MemorySyncStore(connection('needs_reconcile'), products);
    const result = await new ReconcileKiviCatalogUseCase(store, gateway, secrets, 10).execute(
      TENANT,
      NOW,
    );
    return { store, result };
  };

  it('re-sends missing and stale products, leaves in-sync ones, and marks reconciled', async (): Promise<void> => {
    const gateway = new RecordingGateway();
    gateway.identities.set('stale', {
      externalId: 'stale',
      kiviProductId: 'k1',
      version: 1,
      deleted: false,
    });
    gateway.identities.set('ok', {
      externalId: 'ok',
      kiviProductId: 'k2',
      version: 4,
      deleted: false,
    });
    gateway.identities.set('tomb', {
      externalId: 'tomb',
      kiviProductId: 'k3',
      version: 9,
      deleted: true,
    });
    gateway.kiviIds = ['k1', 'k2', 'k3'];
    const { store, result } = await run(
      [
        product('missing', { version: 0 }),
        product('stale', { version: 3 }),
        product('ok', { version: 3 }),
        product('tomb', { version: 20 }),
      ],
      gateway,
    );
    expect(gateway.puts.map((p): string => p.id).sort()).toEqual(['missing', 'stale', 'tomb']);
    expect(result).toMatchObject({ sent: 3, deleted: 0, diverged: 0, unmappedKiviProducts: 0 });
    expect(store.saved.at(-1)?.getStatus()).toBe('active');
    expect(store.saved.at(-1)?.getLastReconciledAt()).toEqual(NOW);
  });

  it('deletes orphans: archived products Kivi still serves, and ignores never-synced archived ones', async (): Promise<void> => {
    const gateway = new RecordingGateway();
    gateway.identities.set('gone', {
      externalId: 'gone',
      kiviProductId: 'k1',
      version: 2,
      deleted: false,
    });
    gateway.kiviIds = ['k1'];
    const { result } = await run(
      [
        product('gone', { status: 'archived', version: 5 }),
        product('never', { status: 'archived', version: 2 }),
      ],
      gateway,
    );
    expect(gateway.deletes).toEqual([{ id: 'gone', version: 6 }]);
    expect(result.deleted).toBe(1);
  });

  it('resolves a Kivi version that is ahead with Canal as source of truth, bumping above it', async (): Promise<void> => {
    const gateway = new RecordingGateway();
    gateway.identities.set('ahead', {
      externalId: 'ahead',
      kiviProductId: 'k1',
      version: 50,
      deleted: false,
    });
    gateway.kiviIds = ['k1'];
    const { store, result } = await run([product('ahead', { version: 3 })], gateway);
    expect(gateway.puts).toHaveLength(1);
    expect(gateway.puts[0].payload.version).toBe(51);
    // Canal's own kivi version was 4: the persisted offset keeps later deliveries monotonic.
    expect(store.raisedOffsets).toEqual([{ productId: 'ahead', offset: 47 }]);
    expect(result.diverged).toBe(0);
    expect(result.divergencesResolved).toBe(1);
    expect(store.saved.at(-1)?.getStatus()).toBe('active');
    expect(store.saved.at(-1)?.getLastReconciledAt()).toEqual(NOW);
  });

  it('deletes an archived product with a version above Kivi when Kivi is ahead', async (): Promise<void> => {
    const gateway = new RecordingGateway();
    gateway.identities.set('old', {
      externalId: 'old',
      kiviProductId: 'k',
      version: 20,
      deleted: false,
    });
    gateway.kiviIds = ['k'];
    const { store, result } = await run(
      [product('old', { version: 2, status: 'archived' })],
      gateway,
    );
    expect(gateway.deletes).toEqual([{ id: 'old', version: 21 }]);
    expect(store.raisedOffsets).toEqual([{ productId: 'old', offset: 18 }]);
    expect(result.divergencesResolved).toBe(1);
    expect(result.diverged).toBe(0);
  });

  it('stays needs-reconcile when the bumped write is still rejected with a conflict', async (): Promise<void> => {
    const gateway = new RecordingGateway();
    gateway.identities.set('a', {
      externalId: 'a',
      kiviProductId: 'k',
      version: 9,
      deleted: false,
    });
    gateway.failWith = new KiviGatewayException('conflict', 409);
    const { store, result } = await run([product('a', { version: 0 })], gateway);
    expect(result.diverged).toBe(1);
    expect(result.divergencesResolved).toBe(0);
    expect(store.saved.at(-1)?.getStatus()).toBe('needs_reconcile');
  });

  it('reports Kivi products with no Canal mapping without deleting them', async (): Promise<void> => {
    const gateway = new RecordingGateway();
    gateway.identities.set('a', {
      externalId: 'a',
      kiviProductId: 'k1',
      version: 1,
      deleted: false,
    });
    gateway.kiviIds = ['k1', 'manual-dashboard-product'];
    const { result } = await run([product('a', { version: 0 })], gateway);
    expect(result.unmappedKiviProducts).toBe(1);
    expect(gateway.deletes).toEqual([]);
  });

  it('counts a 409 on resend as divergence instead of retrying blindly', async (): Promise<void> => {
    const gateway = new RecordingGateway();
    gateway.failWith = new KiviGatewayException('conflict', 409);
    const { result, store } = await run([product('x')], gateway);
    expect(result.diverged).toBe(1);
    expect(store.saved.at(-1)?.getStatus()).toBe('needs_reconcile');
  });
});
