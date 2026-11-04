import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { InvitationRepositoryPort } from '@/iam/application/ports/out/invitation-repository.port';
import { Invitation } from '@/iam/domain/entities/invitation.entity';
import { parseInvitationAccountMode } from '@/iam/domain/value-objects/invitation-account-mode.vo';
import { runInTx, type TxSql } from '@/iam/infrastructure/postgres/user-management-sql';

interface InvitationRow {
  id: string;
  tenant_id: string;
  role_id: string;
  token_hash: string;
  expires_at: Date;
  max_uses: number;
  use_count: number;
  revoked_at: Date | null;
  created_by: string;
  created_at: Date;
  account_mode: string;
}

/** Persists only the token hash; the raw token never reaches this adapter. */
export class PostgresInvitationRepository implements InvitationRepositoryPort {
  public async findById(
    invitationId: string,
    tenantId: string,
    tx: TransactionContext,
  ): Promise<Invitation | null> {
    return runInTx(
      tx,
      'Unable to load the invitation',
      async (sql: TxSql): Promise<Invitation | null> => {
        const rows = await sql<InvitationRow[]>`SELECT id, tenant_id, role_id, token_hash,
            expires_at, max_uses, use_count, revoked_at, created_by, created_at, account_mode
          FROM core.tenant_invitations
          WHERE id = ${invitationId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
        const row = rows[0];
        return row
          ? Invitation.reconstitute({
              id: row.id,
              tenantId: row.tenant_id,
              roleId: row.role_id,
              tokenHash: row.token_hash,
              expiresAt: row.expires_at,
              maxUses: row.max_uses,
              useCount: row.use_count,
              revokedAt: row.revoked_at,
              createdBy: row.created_by,
              createdAt: row.created_at,
              accountMode: parseInvitationAccountMode(row.account_mode),
            })
          : null;
      },
    );
  }

  public async save(invitation: Invitation, tx: TransactionContext): Promise<void> {
    const s = invitation.toSnapshot();
    await runInTx(tx, 'Unable to save the invitation', async (sql: TxSql): Promise<void> => {
      await sql`INSERT INTO core.tenant_invitations
          (id, tenant_id, role_id, token_hash, expires_at, max_uses, use_count, revoked_at,
           created_by, created_at, account_mode)
        VALUES (${s.id}::uuid, ${s.tenantId}::uuid, ${s.roleId}::uuid, ${s.tokenHash},
                ${s.expiresAt}, ${s.maxUses}, ${s.useCount}, ${s.revokedAt},
                ${s.createdBy}::uuid, ${s.createdAt}, ${s.accountMode})
        ON CONFLICT (id) DO UPDATE SET
          use_count = EXCLUDED.use_count, revoked_at = EXCLUDED.revoked_at
        WHERE core.tenant_invitations.tenant_id = EXCLUDED.tenant_id`;
    });
  }
}
