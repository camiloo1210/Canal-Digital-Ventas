import { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';
import { InvitationNotUsableException } from '@/iam/domain/exceptions/invitation-not-usable.exception';
import {
  DEFAULT_INVITATION_ACCOUNT_MODE,
  parseInvitationAccountMode,
  type InvitationAccountMode,
} from '@/iam/domain/value-objects/invitation-account-mode.vo';

export const INVITATION_DEFAULT_EXPIRY_DAYS = 7;
export const INVITATION_MAX_EXPIRY_DAYS = 30;
export const INVITATION_MAX_USES_LIMIT = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface InvitationSnapshot {
  id: string;
  tenantId: string;
  roleId: string;
  tokenHash: string;
  expiresAt: Date;
  maxUses: number;
  useCount: number;
  revokedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  accountMode: InvitationAccountMode;
}

export class Invitation {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly roleId: string,
    private readonly tokenHash: string,
    private readonly expiresAt: Date,
    private readonly maxUses: number,
    private useCount: number,
    private revokedAt: Date | null,
    private readonly createdBy: string,
    private readonly createdAt: Date,
    private readonly accountMode: InvitationAccountMode,
  ) {}

  public static create(props: {
    id: string;
    tenantId: string;
    roleId: string;
    tokenHash: string;
    createdBy: string;
    now: Date;
    expiresInDays?: number;
    maxUses?: number;
    accountMode?: InvitationAccountMode;
  }): Invitation {
    const accountMode = parseInvitationAccountMode(
      props.accountMode ?? DEFAULT_INVITATION_ACCOUNT_MODE,
    );
    const days = props.expiresInDays ?? INVITATION_DEFAULT_EXPIRY_DAYS;
    const maxUses = props.maxUses ?? 1;
    if (!/^[0-9a-f]{64}$/.test(props.tokenHash)) {
      throw new InvalidInvitationException('Token hash must be a SHA-256 hex digest');
    }
    if (!Number.isInteger(days) || days < 1 || days > INVITATION_MAX_EXPIRY_DAYS) {
      throw new InvalidInvitationException(
        `Expiry must be between 1 and ${INVITATION_MAX_EXPIRY_DAYS} days`,
      );
    }
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > INVITATION_MAX_USES_LIMIT) {
      throw new InvalidInvitationException(
        `Max uses must be between 1 and ${INVITATION_MAX_USES_LIMIT}`,
      );
    }
    if (!props.roleId || !props.tenantId || !props.createdBy) {
      throw new InvalidInvitationException('Tenant, role and creator are required');
    }
    return new Invitation(
      props.id,
      props.tenantId,
      props.roleId,
      props.tokenHash,
      new Date(props.now.getTime() + days * DAY_MS),
      maxUses,
      0,
      null,
      props.createdBy,
      props.now,
      accountMode,
    );
  }

  public static reconstitute(snapshot: InvitationSnapshot): Invitation {
    return new Invitation(
      snapshot.id,
      snapshot.tenantId,
      snapshot.roleId,
      snapshot.tokenHash,
      snapshot.expiresAt,
      snapshot.maxUses,
      snapshot.useCount,
      snapshot.revokedAt,
      snapshot.createdBy,
      snapshot.createdAt,
      snapshot.accountMode,
    );
  }

  public isUsable(now: Date): boolean {
    return (
      this.revokedAt === null &&
      this.expiresAt.getTime() > now.getTime() &&
      this.useCount < this.maxUses
    );
  }

  public revoke(now: Date): void {
    if (this.revokedAt === null) this.revokedAt = now;
  }

  public consume(now: Date): void {
    if (!this.isUsable(now)) throw new InvitationNotUsableException();
    this.useCount += 1;
  }

  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getRoleId(): string {
    return this.roleId;
  }

  public getTokenHash(): string {
    return this.tokenHash;
  }

  public toSnapshot(): InvitationSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      roleId: this.roleId,
      tokenHash: this.tokenHash,
      expiresAt: this.expiresAt,
      maxUses: this.maxUses,
      useCount: this.useCount,
      revokedAt: this.revokedAt,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      accountMode: this.accountMode,
    };
  }
}
