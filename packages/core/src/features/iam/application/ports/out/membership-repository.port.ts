import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface MemberRecord {
  userId: string;
  baseRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  status: 'active' | 'suspended' | 'invited';
  /** Tenant that owns the account (generated-email staff), or null for personal accounts. */
  accountManagedByTenantId: string | null;
}

export interface MembershipRepositoryPort {
  find(
    tenantId: string,
    memberUserId: string,
    tx: TransactionContext,
  ): Promise<MemberRecord | null>;
  assignCustomRole(
    tenantId: string,
    memberUserId: string,
    roleId: string | null,
    tx: TransactionContext,
  ): Promise<void>;
  /** Deletes the membership of a non owner member. */
  remove(tenantId: string, memberUserId: string, tx: TransactionContext): Promise<void>;
  setStatus(
    tenantId: string,
    memberUserId: string,
    status: 'active' | 'suspended',
    tx: TransactionContext,
  ): Promise<void>;
  /** Number of memberships the user still has in any tenant. */
  countForUser(memberUserId: string, tx: TransactionContext): Promise<number>;
}
