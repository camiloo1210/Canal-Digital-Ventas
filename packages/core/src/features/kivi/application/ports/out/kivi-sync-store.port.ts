import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';

/** Product state as the worker reads it (tenant-scoped, narrow projection). */
export interface KiviSourceProduct {
  id: string;
  tenantId: string;
  name: string;
  priceCents: number;
  description: string | null;
  stock: number;
  status: 'active' | 'inactive' | 'out_of_stock' | 'archived';
  /** Persisted aggregate version (starts at 0). */
  version: number;
  /**
   * Persisted per-product bump added on top of `version + 1` when Kivi was ahead of Canal and
   * reconcile re-based the product above it. Defaults to 0; only ever grows.
   */
  kiviVersionOffset?: number;
}

export interface KiviSyncStorePort {
  findConnection(tenantId: string): Promise<KiviConnection | null>;
  /** Atomically reserves eligible retries before applying the bounded batch limit. */
  claimConnectionsDue(staleBefore: Date, now: Date, retryAfter: Date): Promise<KiviConnection[]>;
  /**
   * Invalidates in-flight snapshots for linked tenants with newly exhausted Product events.
   * Pending initial loads stay pending. Each event is acknowledged once.
   */
  flagConnectionsWithDeadProductEvents(): Promise<number>;
  /** Persists a monotonic (never lowered) version offset for one product of the tenant. */
  raiseVersionOffset(tenantId: string, productId: string, offset: number): Promise<void>;
  saveConnectionState(connection: KiviConnection): Promise<void>;
  findProduct(tenantId: string, productId: string): Promise<KiviSourceProduct | null>;
  /** Keyset pagination ordered by id. */
  listProducts(
    tenantId: string,
    afterId: string | null,
    limit: number,
  ): Promise<KiviSourceProduct[]>;
}
