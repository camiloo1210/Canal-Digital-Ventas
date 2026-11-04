import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type {
  InvitationAcceptanceCommand,
  InvitationAcceptancePort,
  InvitationAcceptanceResult,
} from '@/iam/application/ports/out/invitation-acceptance.port';
import { InvitationNotUsableException } from '@/iam/domain/exceptions/invitation-not-usable.exception';
import { AlreadyMemberException } from '@/iam/application/exceptions/already-member.exception';
import { BusinessAccountBoundException } from '@/iam/application/exceptions/business-account-bound.exception';
import { UserManagementRepositoryException } from '@/iam/application/exceptions/user-management-repository.exception';
import {
  postgresErrorCode,
  runInTx,
  type TxSql,
} from '@/iam/infrastructure/postgres/user-management-sql';

interface AcceptRow {
  tenant_id: string;
  role_id: string;
}

/** Calls the SECURITY DEFINER core.accept_invitation RPC (atomic, validates, consumes, samples). */
export class PostgresInvitationAcceptanceAdapter implements InvitationAcceptancePort {
  public async accept(
    command: InvitationAcceptanceCommand,
    tx: TransactionContext,
  ): Promise<InvitationAcceptanceResult> {
    try {
      return await runInTx(
        tx,
        'Unable to accept the invitation',
        async (sql: TxSql): Promise<InvitationAcceptanceResult> => {
          const rows = await sql<AcceptRow[]>`SELECT tenant_id, role_id FROM core.accept_invitation(
            ${command.tokenHash}, ${command.userId}::uuid, ${command.consent},
            ${command.ageRange}, ${command.gender}, ${command.province},
            ${command.firstName}, ${command.lastName})`;
          const row = rows[0];
          if (!row) throw new InvitationNotUsableException();
          return { tenantId: row.tenant_id, roleId: row.role_id };
        },
      );
    } catch (error: unknown) {
      const cause =
        error instanceof UserManagementRepositoryException ? error.originalError : error;
      const code = postgresErrorCode(cause);
      if (code === 'P0001') throw new InvitationNotUsableException();
      if (code === 'P0002') throw new AlreadyMemberException();
      if (code === 'P0004') throw new BusinessAccountBoundException();
      throw error;
    }
  }
}
