import type postgres from 'postgres';
import type {
  KiviSourceProduct,
  KiviSyncStorePort,
} from '@/kivi/application/ports/out/kivi-sync-store.port';
import {
  KiviConnection,
  type KiviConnectionStatus,
} from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviBaseUrl, type KiviBaseUrlOptions } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { KiviSecretRef } from '@/kivi/domain/value-objects/kivi-secret-ref.vo';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';
import { KiviStaleSyncException } from '@/kivi/application/exceptions/kivi-stale-sync.exception';

interface ConnectionRow {
  sync_generation: number;
  tenant_id: string;
  base_url: string;
  connection_id: string;
  secret_ref: string | null;
  token_ciphertext: string | null;
  token_key_version: number | null;
  status: KiviConnectionStatus;
  last_reconciled_at: Date | null;
}

interface ProductRow {
  id: string;
  tenant_id: string;
  name: string;
  price_cents: number;
  description: string | null;
  stock: number;
  status: KiviSourceProduct['status'];
  version: number;
  kivi_version_offset: number;
}

export class KiviSyncStoreException extends InfrastructureException {
  public constructor(message: string, originalError?: unknown) {
    super(message, originalError);
    this.name = 'KiviSyncStoreException';
  }
}

/** Worker-side store. Uses only the narrow core.kivi_sync_* functions: no direct table access. */
export class PostgresKiviSyncStoreAdapter implements KiviSyncStorePort {
  public constructor(
    private readonly sql: postgres.Sql<Record<string, unknown>>,
    private readonly urlOptions: KiviBaseUrlOptions,
  ) {}

  public async findConnection(tenantId: string): Promise<KiviConnection | null> {
    const rows = await this.run(
      (): Promise<ConnectionRow[]> =>
        this.sql<
          ConnectionRow[]
        >`SELECT * FROM core.kivi_sync_get_connection_v3(${tenantId}::uuid)`,
      'Unable to load the Kivi connection',
    );
    return rows[0] ? this.toConnection(rows[0]) : null;
  }

  public async claimConnectionsDue(
    staleBefore: Date,
    now: Date,
    retryAfter: Date,
  ): Promise<KiviConnection[]> {
    const rows = await this.run(
      (): Promise<ConnectionRow[]> =>
        this.sql<
          ConnectionRow[]
        >`SELECT * FROM core.kivi_sync_claim_due(${staleBefore.toISOString()}::timestamptz,
          ${now.toISOString()}::timestamptz, ${retryAfter.toISOString()}::timestamptz)`,
      'Unable to list Kivi connections',
    );
    const connections: KiviConnection[] = [];
    for (const row of rows) {
      try {
        connections.push(this.toConnection(row));
      } catch {
        // A row that no longer satisfies the URL policy is skipped, never contacted.
      }
    }
    return connections;
  }

  public async flagConnectionsWithDeadProductEvents(): Promise<number> {
    const rows = await this.run(
      (): Promise<Array<{ flagged: number }>> =>
        this.sql<Array<{ flagged: number }>>`SELECT core.kivi_sync_flag_dead_events() AS flagged`,
      'Unable to flag Kivi connections with exhausted events',
    );
    return Number(rows[0]?.flagged ?? 0);
  }

  public async raiseVersionOffset(
    tenantId: string,
    productId: string,
    offset: number,
  ): Promise<void> {
    await this.run(
      (): Promise<Record<string, unknown>[]> =>
        this.sql<
          Record<string, unknown>[]
        >`SELECT core.kivi_sync_raise_version_offset(${tenantId}::uuid, ${productId}::uuid, ${offset}::integer)`,
      'Unable to persist the Kivi version offset',
    );
  }

  public async saveConnectionState(connection: KiviConnection): Promise<void> {
    const status = connection.getStatus();
    if (status === 'unlinked') return;
    const lastReconciledAt = connection.getLastReconciledAt()?.toISOString() ?? null;
    const rows = await this.run(
      (): Promise<Array<{ saved: boolean }>> =>
        this.sql<Array<{ saved: boolean }>>`SELECT core.kivi_sync_save_state_v2(
          ${connection.getTenantId()}::uuid, ${connection.getConnectionId()}::uuid,
          ${connection.getGeneration()}::integer, ${status}::text, ${lastReconciledAt}::timestamptz) AS saved`,
      'Unable to save the Kivi connection state',
    );
    if (!rows[0]?.saved) throw new KiviStaleSyncException();
  }

  public async findProduct(tenantId: string, productId: string): Promise<KiviSourceProduct | null> {
    const rows = await this.run(
      (): Promise<ProductRow[]> =>
        this.sql<
          ProductRow[]
        >`SELECT * FROM core.kivi_sync_get_product_with_offset(${tenantId}::uuid, ${productId}::uuid)`,
      'Unable to load the product',
    );
    return rows[0] ? this.toProduct(rows[0]) : null;
  }

  public async listProducts(
    tenantId: string,
    afterId: string | null,
    limit: number,
  ): Promise<KiviSourceProduct[]> {
    const rows = await this.run(
      (): Promise<ProductRow[]> =>
        this.sql<
          ProductRow[]
        >`SELECT * FROM core.kivi_sync_list_products_with_offset(${tenantId}::uuid, ${afterId}::uuid, ${limit}::integer)`,
      'Unable to list products',
    );
    return rows.map((row): KiviSourceProduct => this.toProduct(row));
  }

  private async run<T>(operation: () => Promise<T>, message: string): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw new KiviSyncStoreException(message, error);
    }
  }

  private toConnection(row: ConnectionRow): KiviConnection {
    return KiviConnection.reconstitute({
      generation: row.sync_generation,
      tenantId: row.tenant_id,
      baseUrl: KiviBaseUrl.from(row.base_url, this.urlOptions),
      connectionId: row.connection_id,
      secretRef: row.secret_ref ? KiviSecretRef.from(row.secret_ref) : null,
      encryptedToken: row.token_ciphertext
        ? { ciphertext: row.token_ciphertext, keyVersion: row.token_key_version ?? 1 }
        : null,
      status: row.status,
      lastReconciledAt: row.last_reconciled_at,
    });
  }

  private toProduct(row: ProductRow): KiviSourceProduct {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      priceCents: row.price_cents,
      description: row.description,
      stock: row.stock,
      status: row.status,
      version: row.version,
      kiviVersionOffset: row.kivi_version_offset,
    };
  }
}
