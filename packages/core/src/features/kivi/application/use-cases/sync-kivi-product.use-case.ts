import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type { KiviCatalogGatewayPort } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type { KiviSyncStorePort } from '@/kivi/application/ports/out/kivi-sync-store.port';
import { KiviProductDelivery } from '@/kivi/application/kivi-product-delivery';

export const KIVI_PRODUCT_AGGREGATE = 'Product';

/** Delivers one product outbox event. Resolves only when the event needs no further attempt. */
export class SyncKiviProductUseCase {
  private readonly delivery: KiviProductDelivery;

  public constructor(
    private readonly store: KiviSyncStorePort,
    gateway: KiviCatalogGatewayPort,
    secrets: KiviSecretResolverPort,
  ) {
    this.delivery = new KiviProductDelivery(gateway, secrets);
  }

  public async execute(event: IntegrationEvent): Promise<void> {
    if (event.aggregateType !== KIVI_PRODUCT_AGGREGATE) return;
    const connection = await this.store.findConnection(event.tenantId);
    if (!connection || !connection.isSyncing()) return;
    const product = await this.store.findProduct(event.tenantId, event.aggregateId);
    if (!product) return;

    const target = this.delivery.targetOf(connection);
    const outcome = await this.delivery.send(target, product);
    if (outcome === 'conflict') {
      // The source of truth and Kivi disagree on this version: reconcile, never bump blindly.
      connection.flagNeedsReconcile();
      await this.store.saveConnectionState(connection);
    }
  }
}
