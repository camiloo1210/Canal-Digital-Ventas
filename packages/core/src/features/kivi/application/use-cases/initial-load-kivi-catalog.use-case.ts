import type { KiviCatalogGatewayPort } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type { KiviSyncStorePort } from '@/kivi/application/ports/out/kivi-sync-store.port';
import { KiviProductDelivery } from '@/kivi/application/kivi-product-delivery';
import { KiviConnectionNotFoundException } from '@/kivi/application/exceptions/kivi-connection-not-found.exception';

export interface InitialLoadResult {
  sent: number;
  conflicts: number;
}

/**
 * Sends every live product of a store with the same external id/version the outbox uses.
 * Idempotent: a retry after a transient failure resends identical payloads.
 */
export class InitialLoadKiviCatalogUseCase {
  private readonly delivery: KiviProductDelivery;

  public constructor(
    private readonly store: KiviSyncStorePort,
    gateway: KiviCatalogGatewayPort,
    secrets: KiviSecretResolverPort,
    private readonly pageSize: number = 100,
  ) {
    this.delivery = new KiviProductDelivery(gateway, secrets);
  }

  public async execute(tenantId: string, now: Date): Promise<InitialLoadResult> {
    const connection = await this.store.findConnection(tenantId);
    if (!connection || !connection.isSyncing()) throw new KiviConnectionNotFoundException();
    const target = this.delivery.targetOf(connection);

    let sent = 0;
    let conflicts = 0;
    let cursor: string | null = null;
    for (;;) {
      const page = await this.store.listProducts(tenantId, cursor, this.pageSize);
      if (page.length === 0) break;
      for (const product of page) {
        // Products archived before the first sync never existed in Kivi: nothing to tombstone.
        if (product.status === 'archived') continue;
        const outcome = await this.delivery.send(target, product);
        if (outcome === 'conflict') conflicts++;
        else sent++;
      }
      cursor = page[page.length - 1].id;
      if (page.length < this.pageSize) break;
    }

    connection.completeInitialLoad(now);
    if (conflicts > 0) connection.flagNeedsReconcile();
    await this.store.saveConnectionState(connection);
    return { sent, conflicts };
  }
}
