import { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviBaseUrl } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { KiviSecretRef } from '@/kivi/domain/value-objects/kivi-secret-ref.vo';
import type {
  KiviCatalogGatewayPort,
  KiviProductIdentity,
  KiviProductPayload,
  KiviTarget,
} from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type {
  KiviSourceProduct,
  KiviSyncStorePort,
} from '@/kivi/application/ports/out/kivi-sync-store.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';

export const TENANT = '11111111-1111-4111-8111-111111111111';
export const TOKEN = 'kc_' + 'A'.repeat(43);

export function connection(
  status: 'pending' | 'active' | 'needs_reconcile' = 'active',
): KiviConnection {
  const linked = KiviConnection.link({
    tenantId: TENANT,
    baseUrl: KiviBaseUrl.from('https://api.kivi.example'),
    connectionId: '22222222-2222-4222-8222-222222222222',
    secretRef: KiviSecretRef.from('KIVI_CONNECTION_TOKEN_STORE'),
  });
  if (status === 'active') linked.completeInitialLoad(new Date('2026-10-01T00:00:00Z'));
  if (status === 'needs_reconcile') {
    linked.completeInitialLoad(new Date('2026-10-01T00:00:00Z'));
    linked.flagNeedsReconcile();
  }
  return linked;
}

export function product(id: string, overrides: Partial<KiviSourceProduct> = {}): KiviSourceProduct {
  return {
    id,
    tenantId: TENANT,
    name: `Product ${id}`,
    priceCents: 1000,
    description: null,
    stock: 3,
    status: 'active',
    version: 0,
    ...overrides,
  };
}

export class MemorySyncStore implements KiviSyncStorePort {
  public saved: KiviConnection[] = [];
  public raisedOffsets: Array<{ productId: string; offset: number }> = [];
  public deadEventFlags = 0;
  public constructor(
    public conn: KiviConnection | null,
    public products: KiviSourceProduct[] = [],
  ) {}
  public async findConnection(): Promise<KiviConnection | null> {
    return this.conn;
  }
  public async claimConnectionsDue(): Promise<KiviConnection[]> {
    return this.conn ? [this.conn] : [];
  }
  public async saveConnectionState(c: KiviConnection): Promise<void> {
    this.saved.push(c);
  }
  public async flagConnectionsWithDeadProductEvents(): Promise<number> {
    return this.deadEventFlags;
  }
  public async raiseVersionOffset(
    _tenantId: string,
    productId: string,
    offset: number,
  ): Promise<void> {
    this.raisedOffsets.push({ productId, offset });
  }
  public async findProduct(_tenantId: string, id: string): Promise<KiviSourceProduct | null> {
    return this.products.find((p): boolean => p.id === id) ?? null;
  }
  public async listProducts(
    _tenantId: string,
    afterId: string | null,
    limit: number,
  ): Promise<KiviSourceProduct[]> {
    return [...this.products]
      .sort((a, b): number => a.id.localeCompare(b.id))
      .filter((p): boolean => afterId === null || p.id > afterId)
      .slice(0, limit);
  }
}

export class RecordingGateway implements KiviCatalogGatewayPort {
  public puts: Array<{ id: string; payload: KiviProductPayload; target: KiviTarget }> = [];
  public deletes: Array<{ id: string; version: number }> = [];
  public identities = new Map<string, KiviProductIdentity>();
  public kiviIds: string[] = [];
  public failWith: Error | null = null;
  public async putProduct(
    target: KiviTarget,
    id: string,
    payload: KiviProductPayload,
  ): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.puts.push({ id, payload, target });
  }
  public async deleteProduct(_target: KiviTarget, id: string, version: number): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.deletes.push({ id, version });
  }
  public async getIdentity(_target: KiviTarget, id: string): Promise<KiviProductIdentity | null> {
    return this.identities.get(id) ?? null;
  }
  public async listKiviProductIds(): Promise<string[]> {
    return this.kiviIds;
  }
}

export const secrets: KiviSecretResolverPort = {
  resolve: (conn: KiviConnection): string | null =>
    conn.getSecretRef()?.getValue() === 'KIVI_CONNECTION_TOKEN_STORE' ? TOKEN : null,
};
