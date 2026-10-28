import type {
  KiviCatalogGatewayPort,
  KiviProductIdentity,
} from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type {
  KiviSourceProduct,
  KiviSyncStorePort,
} from '@/kivi/application/ports/out/kivi-sync-store.port';
import { KiviProductDelivery } from '@/kivi/application/kivi-product-delivery';
import { kiviVersionOf } from '@/kivi/application/kivi-product.mapper';
import { KiviConnectionNotFoundException } from '@/kivi/application/exceptions/kivi-connection-not-found.exception';

export interface ReconcileResult {
  sent: number;
  deleted: number;
  /** Products Kivi still rejects with a version conflict after a re-base; retried later. */
  diverged: number;
  /** Products Kivi held at a newer version, re-based above it with Canal as source of truth. */
  divergencesResolved: number;
  /** Kivi catalog entries with no Canal mapping (e.g. created in the Kivi dashboard); reported only. */
  unmappedKiviProducts: number;
}

/**
 * Compares Canal ids/versions with Kivi identities. Resends missing/stale products and deletes
 * orphans (archived in Canal, still live in Kivi). When Kivi is ahead of Canal (manual change or
 * version reset) Canal wins: the product is re-sent with a version above Kivi's, and the bump is
 * persisted as a per-product offset so later outbox deliveries stay monotonic. Normal outbox
 * deliveries never do this: they keep 409-on-stale safety. Kivi's list endpoint exposes no external id,
 * so entries absent from every Canal identity mapping can only be counted, not deleted.
 */
export class ReconcileKiviCatalogUseCase {
  private readonly delivery: KiviProductDelivery;

  public constructor(
    private readonly store: KiviSyncStorePort,
    private readonly gateway: KiviCatalogGatewayPort,
    secrets: KiviSecretResolverPort,
    private readonly pageSize: number = 100,
  ) {
    this.delivery = new KiviProductDelivery(gateway, secrets);
  }

  public async execute(tenantId: string, now: Date): Promise<ReconcileResult> {
    const connection = await this.store.findConnection(tenantId);
    if (!connection || !connection.isSyncing()) throw new KiviConnectionNotFoundException();
    const target = this.delivery.targetOf(connection);

    const result: ReconcileResult = {
      sent: 0,
      deleted: 0,
      diverged: 0,
      divergencesResolved: 0,
      unmappedKiviProducts: 0,
    };
    const mappedKiviIds = new Set<string>();
    let cursor: string | null = null;
    for (;;) {
      const page = await this.store.listProducts(tenantId, cursor, this.pageSize);
      if (page.length === 0) break;
      for (const product of page) {
        const identity = await this.fetchIdentity(target, product.id);
        if (identity?.kiviProductId) mappedKiviIds.add(identity.kiviProductId);
        const version = kiviVersionOf(product);

        const kiviAhead = identity !== null && identity.version > version;

        if (product.status === 'archived') {
          if (!identity || identity.deleted) continue;
          const outcome = await this.send(tenantId, target, product, kiviAhead ? identity : null);
          if (outcome === 'conflict') result.diverged++;
          else if (kiviAhead) result.divergencesResolved++;
          else result.deleted++;
          continue;
        }

        if (identity && !identity.deleted && identity.version === version) continue;
        const outcome = await this.send(tenantId, target, product, kiviAhead ? identity : null);
        if (outcome === 'conflict') result.diverged++;
        else if (kiviAhead) result.divergencesResolved++;
        else result.sent++;
      }
      cursor = page[page.length - 1].id;
      if (page.length < this.pageSize) break;
    }

    const kiviIds = await this.listKiviIds(target);
    result.unmappedKiviProducts = kiviIds.filter((id): boolean => !mappedKiviIds.has(id)).length;

    if (result.diverged === 0) connection.markReconciled(now);
    else connection.flagNeedsReconcile();
    await this.store.saveConnectionState(connection);
    return result;
  }

  /** Sends the product; when Kivi is ahead, first persists a re-based version above Kivi's. */
  private async send(
    tenantId: string,
    target: Parameters<KiviCatalogGatewayPort['getIdentity']>[0],
    product: KiviSourceProduct,
    ahead: KiviProductIdentity | null,
  ): ReturnType<KiviProductDelivery['send']> {
    if (!ahead) return this.delivery.send(target, product);
    const offset = ahead.version + 1 - (product.version + 1);
    // Persisted first: a higher offset is always safe, while a lost bump would re-diverge.
    await this.store.raiseVersionOffset(tenantId, product.id, offset);
    return this.delivery.send(target, { ...product, kiviVersionOffset: offset });
  }

  private async fetchIdentity(
    target: Parameters<KiviCatalogGatewayPort['getIdentity']>[0],
    externalId: string,
  ): ReturnType<KiviCatalogGatewayPort['getIdentity']> {
    try {
      return await this.gateway.getIdentity(target, externalId);
    } catch (error: unknown) {
      throw KiviProductDelivery.toDeliveryFailure(error);
    }
  }

  private async listKiviIds(
    target: Parameters<KiviCatalogGatewayPort['listKiviProductIds']>[0],
  ): Promise<string[]> {
    try {
      return await this.gateway.listKiviProductIds(target);
    } catch (error: unknown) {
      throw KiviProductDelivery.toDeliveryFailure(error);
    }
  }
}
