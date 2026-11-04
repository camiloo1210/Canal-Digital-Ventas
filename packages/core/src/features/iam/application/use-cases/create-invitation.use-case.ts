import type { InvitationRepositoryPort } from '@/iam/application/ports/out/invitation-repository.port';
import type { TenantRoleRepositoryPort } from '@/iam/application/ports/out/tenant-role-repository.port';
import type { TenantOwnershipPort } from '@/iam/application/ports/out/tenant-ownership.port';
import type { TokenGeneratorPort } from '@/iam/application/ports/out/token-generator.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import type { InvitationAccountMode } from '@/iam/domain/value-objects/invitation-account-mode.vo';
import { Invitation } from '@/iam/domain/entities/invitation.entity';
import { assertStoreOwner } from '@/iam/application/assert-store-owner';
import { TenantRoleNotFoundException } from '@/iam/application/exceptions/tenant-role-not-found.exception';

export interface CreateInvitationDto {
  userId: string;
  tenantId: string;
  roleId: string;
  expiresInDays?: number;
  maxUses?: number;
  accountMode?: InvitationAccountMode;
}

export interface CreateInvitationResult {
  invitationId: string;
  /** Raw token: returned exactly once, never persisted. */
  token: string;
  expiresAt: string;
}

export class CreateInvitationUseCase {
  public constructor(
    private readonly invitations: InvitationRepositoryPort,
    private readonly roles: TenantRoleRepositoryPort,
    private readonly ownership: TenantOwnershipPort,
    private readonly transactions: TransactionManagerPort,
    private readonly tokens: TokenGeneratorPort,
    private readonly newId: () => string = (): string => crypto.randomUUID(),
    private readonly now: () => Date = (): Date => new Date(),
  ) {}

  public async execute(dto: CreateInvitationDto): Promise<CreateInvitationResult> {
    return this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<CreateInvitationResult> => {
        await assertStoreOwner(this.ownership, dto.userId, dto.tenantId, tx);
        const role = await this.roles.findById(dto.roleId, dto.tenantId, tx);
        if (!role) throw new TenantRoleNotFoundException();
        const token = this.tokens.generate();
        const invitation = Invitation.create({
          id: this.newId(),
          tenantId: dto.tenantId,
          roleId: role.getId(),
          tokenHash: this.tokens.hash(token),
          createdBy: dto.userId,
          now: this.now(),
          expiresInDays: dto.expiresInDays,
          maxUses: dto.maxUses,
          accountMode: dto.accountMode,
        });
        await this.invitations.save(invitation, tx);
        return {
          invitationId: invitation.getId(),
          token,
          expiresAt: invitation.toSnapshot().expiresAt.toISOString(),
        };
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}
