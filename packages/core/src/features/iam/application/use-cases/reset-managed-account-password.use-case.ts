import type { MembershipRepositoryPort } from '@/iam/application/ports/out/membership-repository.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type { AdminAuthPort } from '@/iam/application/ports/out/admin-auth.port';
import type { SessionRevocationPort } from '@/iam/application/ports/out/session-revocation.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { assertStoreOwner } from '@/iam/application/assert-store-owner';
import { assertManagedBy, loadNonOwnerMember } from '@/iam/application/managed-member';
import { AdminAuthUnavailableException } from '@/iam/application/exceptions/admin-auth-unavailable.exception';
import { InvalidManagedPasswordException } from '@/iam/domain/exceptions/invalid-managed-password.exception';

export const MANAGED_PASSWORD_MIN_LENGTH = 8;

export interface ResetManagedAccountPasswordDto {
  userId: string;
  tenantId: string;
  memberUserId: string;
  /** Never logged or echoed. */
  newPassword: string;
}

export interface ResetManagedAccountPasswordResult {
  passwordChanged: true;
  /** False when the password was changed but the old sessions could not be dropped. */
  sessionsRevoked: boolean;
}

/**
 * 1. A short read-only transaction authorises the actor and the target (no external call inside it).
 * 2. After it completes, the auth provider changes the password. If this fails nothing changed.
 * 3. Then the account sessions are revoked. If this fails the password is already changed, so the
 *    outcome reports sessionsRevoked=false instead of an error.
 */
export class ResetManagedAccountPasswordUseCase {
  public constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly ownership: TenantOwnershipPort,
    private readonly admin: AdminAuthPort | null,
    private readonly transactions: TransactionManagerPort,
    private readonly sessions: SessionRevocationPort,
  ) {}

  public async execute(
    dto: ResetManagedAccountPasswordDto,
  ): Promise<ResetManagedAccountPasswordResult> {
    await this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<void> => {
        await assertStoreOwner(this.ownership, dto.userId, dto.tenantId, tx);
        const member = await loadNonOwnerMember(
          this.memberships,
          dto.tenantId,
          dto.memberUserId,
          tx,
        );
        assertManagedBy(member, dto.tenantId);
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
    if (dto.newPassword.length < MANAGED_PASSWORD_MIN_LENGTH) {
      throw new InvalidManagedPasswordException();
    }
    if (!this.admin) throw new AdminAuthUnavailableException();

    await this.admin.setPassword(dto.memberUserId, dto.newPassword);

    try {
      await this.sessions.revokeSessions(dto.memberUserId);
    } catch {
      return { passwordChanged: true, sessionsRevoked: false };
    }
    return { passwordChanged: true, sessionsRevoked: true };
  }
}
