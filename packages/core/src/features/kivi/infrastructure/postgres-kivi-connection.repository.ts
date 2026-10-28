import type postgres from 'postgres';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import {
  KiviConnection,
  type KiviConnectionStatus,
} from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviBaseUrl, type KiviBaseUrlOptions } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { KiviSecretRef } from '@/kivi/domain/value-objects/kivi-secret-ref.vo';
import { KiviSyncStoreException } from '@/kivi/infrastructure/postgres-kivi-sync-store.adapter';

type Sql = postgres.TransactionSql<Record<string, unknown>>;

interface Row {
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

/**
 * Web-side adapter (transactional). Persists the legacy secret REFERENCE or the already-ENCRYPTED token; it never sees
 * a plaintext credential. Rows are never returned to clients.
 */
export class PostgresKiviConnectionRepository implements KiviConnectionRepositoryPort {
  public constructor(private readonly urlOptions: KiviBaseUrlOptions = {}) {}

  public async isStoreOwner(
    userId: string,
    tenantId: string,
    tx: TransactionContext,
  ): Promise<boolean> {
    return this.run(tx, 'Unable to verify store ownership', async (sql): Promise<boolean> => {
      const rows = await sql`SELECT 1 FROM core.tenant_memberships
        WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid
          AND status = 'active' AND role = 'OWNER' FOR SHARE`;
      return rows.length > 0;
    });
  }

  public async findStoreName(tenantId: string, tx: TransactionContext): Promise<string | null> {
    return this.run(tx, 'Unable to load the store', async (sql): Promise<string | null> => {
      const rows = await sql<Array<{ name: string }>>`SELECT name FROM core.tenants
        WHERE id = ${tenantId}::uuid`;
      return rows[0]?.name ?? null;
    });
  }

  public async findByTenant(
    tenantId: string,
    tx: TransactionContext,
  ): Promise<KiviConnection | null> {
    return this.run(
      tx,
      'Unable to load the Kivi connection',
      async (sql): Promise<KiviConnection | null> => {
        const rows = await sql<
          Row[]
        >`SELECT tenant_id, base_url, connection_id, secret_ref, token_ciphertext,
          token_key_version, status, last_reconciled_at, sync_generation FROM core.kivi_connections WHERE tenant_id = ${tenantId}::uuid FOR UPDATE`;
        const row = rows[0];
        if (!row) return null;
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
      },
    );
  }

  public async save(connection: KiviConnection, tx: TransactionContext): Promise<void> {
    await this.run(tx, 'Unable to save the Kivi connection', async (sql): Promise<void> => {
      await sql`INSERT INTO core.kivi_connections
          (tenant_id, base_url, connection_id, secret_ref, token_ciphertext, token_key_version,
           status, last_reconciled_at)
        VALUES (${connection.getTenantId()}::uuid, ${connection.getBaseUrl().getValue()},
          ${connection.getConnectionId()}::uuid, ${connection.getSecretRef()?.getValue() ?? null},
          ${connection.getEncryptedToken()?.ciphertext ?? null},
          ${connection.getEncryptedToken()?.keyVersion ?? null}::smallint,
          ${connection.getStatus()}, ${connection.getLastReconciledAt()})
        ON CONFLICT (tenant_id) DO UPDATE SET
          base_url = EXCLUDED.base_url, connection_id = EXCLUDED.connection_id,
          secret_ref = EXCLUDED.secret_ref, token_ciphertext = EXCLUDED.token_ciphertext,
          token_key_version = EXCLUDED.token_key_version, status = EXCLUDED.status,
          last_reconciled_at = EXCLUDED.last_reconciled_at,
          next_attempt_at = '-infinity',
          sync_generation = core.kivi_connections.sync_generation + 1, updated_at = NOW()`;
    });
  }

  private async run<T>(
    tx: TransactionContext,
    message: string,
    callback: (sql: Sql) => Promise<T>,
  ): Promise<T> {
    try {
      return await tx.executeNative<Sql, T>(callback);
    } catch (error: unknown) {
      throw new KiviSyncStoreException(message, error);
    }
  }
}
