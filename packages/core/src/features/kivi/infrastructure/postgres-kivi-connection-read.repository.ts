import type postgres from 'postgres';
import type {
  KiviConnectionReadModel,
  KiviConnectionReadRepositoryPort,
  KiviConnectionViewStatus,
} from '@/kivi/application/ports/out/kivi-connection-read.port';
import { KiviSyncStoreException } from '@/kivi/infrastructure/postgres-kivi-sync-store.adapter';

interface Row {
  base_url: string;
  connection_id: string;
  paired: boolean;
  status: KiviConnectionViewStatus;
  last_reconciled_at: Date | null;
}

/** Owner-only projection; the ownership check is part of the query itself. */
export class PostgresKiviConnectionReadRepository implements KiviConnectionReadRepositoryPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async findForOwner(
    userId: string,
    tenantId: string,
  ): Promise<KiviConnectionReadModel | null> {
    try {
      const rows = await this.sql<
        Row[]
      >`SELECT c.base_url, c.connection_id, (c.token_ciphertext IS NOT NULL) AS paired, c.status,
          c.last_reconciled_at
        FROM core.kivi_connections c
        JOIN core.tenant_memberships m ON m.tenant_id = c.tenant_id
        WHERE c.tenant_id = ${tenantId}::uuid AND c.status <> 'unlinked'
          AND m.user_id = ${userId}::uuid AND m.status = 'active' AND m.role = 'OWNER'`;
      const row = rows[0];
      if (!row) return null;
      return {
        baseUrl: row.base_url,
        connectionId: row.connection_id,
        source: row.paired ? 'paired' : 'legacy',
        status: row.status,
        lastReconciledAt: row.last_reconciled_at ? row.last_reconciled_at.toISOString() : null,
      };
    } catch (error: unknown) {
      throw new KiviSyncStoreException('Unable to read the Kivi connection', error);
    }
  }
}
