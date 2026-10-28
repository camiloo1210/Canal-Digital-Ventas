import { describe, expect, it } from 'vitest';
import { SyncKiviProductUseCase } from '@/kivi/application/use-cases/sync-kivi-product.use-case';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import { KiviDeliveryException } from '@/kivi/application/exceptions/kivi-delivery.exception';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import {
  MemorySyncStore,
  RecordingGateway,
  TENANT,
  TOKEN,
  connection,
  product,
  secrets,
} from '@/kivi/application/kivi-test-doubles';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import type { KiviSourceProduct } from '@/kivi/application/ports/out/kivi-sync-store.port';

const event = (id: string, eventType = 'ProductPricingChangedEvent'): IntegrationEvent => ({
  messageId: 'm1',
  tenantId: TENANT,
  aggregateType: 'Product',
  aggregateId: id,
  eventType,
  occurredAt: '2026-10-27T00:00:00.000Z',
  payload: {},
});

function setup(
  products: KiviSourceProduct[] = [product('p1', { version: 4 })],
  conn: KiviConnection = connection(),
): { store: MemorySyncStore; gateway: RecordingGateway; useCase: SyncKiviProductUseCase } {
  const store = new MemorySyncStore(conn, products);
  const gateway = new RecordingGateway();
  return { store, gateway, useCase: new SyncKiviProductUseCase(store, gateway, secrets) };
}

describe('SyncKiviProductUseCase', (): void => {
  it('upserts current state with external id = product id and version = persisted + 1', async (): Promise<void> => {
    const { gateway, useCase } = setup();
    await useCase.execute(event('p1'));
    expect(gateway.puts).toHaveLength(1);
    expect(gateway.puts[0].id).toBe('p1');
    expect(gateway.puts[0].payload.version).toBe(5);
    expect(gateway.puts[0].target).toEqual({
      baseUrl: 'https://api.kivi.example',
      connectionId: '22222222-2222-4222-8222-222222222222',
      token: TOKEN,
    });
  });

  it('turns an archived product into a DELETE with the new version', async (): Promise<void> => {
    const { gateway, useCase } = setup([product('p1', { status: 'archived', version: 9 })]);
    await useCase.execute(event('p1', 'ProductArchivedEvent'));
    expect(gateway.deletes).toEqual([{ id: 'p1', version: 10 }]);
    expect(gateway.puts).toEqual([]);
  });

  it('is a no-op for stores without an active link or for other aggregates', async (): Promise<void> => {
    const unlinked = connection();
    unlinked.unlink();
    const a = setup(undefined, unlinked);
    await a.useCase.execute(event('p1'));
    const b = setup();
    await b.useCase.execute({ ...event('p1'), aggregateType: 'Order' });
    const emptyGateway = new RecordingGateway();
    const c = new SyncKiviProductUseCase(new MemorySyncStore(null), emptyGateway, secrets);
    await c.execute(event('p1'));
    expect(a.gateway.puts).toEqual([]);
    expect(b.gateway.puts).toEqual([]);
    expect(emptyGateway.puts).toEqual([]);
  });

  it('flags needs-reconcile on 409 and completes without bumping the version', async (): Promise<void> => {
    const { store, gateway, useCase } = setup();
    gateway.failWith = new KiviGatewayException('conflict', 409);
    await expect(useCase.execute(event('p1'))).resolves.toBeUndefined();
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0].getStatus()).toBe('needs_reconcile');
    expect(gateway.puts).toEqual([]);
  });

  it('propagates retryable failures with Retry-After so the outbox keeps the event', async (): Promise<void> => {
    const { gateway, useCase } = setup();
    gateway.failWith = new KiviGatewayException('rate_limited', 429, 7000);
    const error = await useCase.execute(event('p1')).catch((e: unknown): unknown => e);
    expect(error).toBeInstanceOf(KiviDeliveryException);
    expect((error as KiviDeliveryException).retryAfterMs).toBe(7000);
    gateway.failWith = new KiviGatewayException('transient', 503);
    await expect(useCase.execute(event('p1'))).rejects.toBeInstanceOf(KiviDeliveryException);
    gateway.failWith = new KiviGatewayException('rejected', 422);
    await expect(useCase.execute(event('p1'))).rejects.toBeInstanceOf(KiviDeliveryException);
  });

  it('fails retryably when the credential is not configured, without calling Kivi', async (): Promise<void> => {
    const store = new MemorySyncStore(connection(), [product('p1')]);
    const gateway = new RecordingGateway();
    const useCase = new SyncKiviProductUseCase(store, gateway, { resolve: (): null => null });
    await expect(useCase.execute(event('p1'))).rejects.toBeInstanceOf(KiviDeliveryException);
    expect(gateway.puts).toEqual([]);
  });

  it('never leaks the token in thrown error messages', async (): Promise<void> => {
    const { gateway, useCase } = setup();
    gateway.failWith = new KiviGatewayException('transient', 500);
    const error = await useCase.execute(event('p1')).catch((e: unknown): Error => e as Error);
    expect(String((error as Error).message)).not.toContain(TOKEN);
  });

  it('uses the persisted offset but still never blind-bumps on a 409', async (): Promise<void> => {
    const { store, gateway, useCase } = setup([
      product('p1', { version: 4, kiviVersionOffset: 47 }),
    ]);
    await useCase.execute(event('p1'));
    expect(gateway.puts[0].payload.version).toBe(52);
    gateway.failWith = new KiviGatewayException('conflict', 409);
    await useCase.execute(event('p1'));
    expect(gateway.puts).toHaveLength(1);
    expect(store.saved.at(-1)?.getStatus()).toBe('needs_reconcile');
  });
});
