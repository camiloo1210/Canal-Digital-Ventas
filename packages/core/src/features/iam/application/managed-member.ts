import type {
  MemberRecord,
  MembershipRepositoryPort,
} from '@/iam/application/ports/out/membership-repository.port';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { MemberNotFoundException } from '@/iam/application/exceptions/member-not-found.exception';
import { ProtectedMemberException } from '@/iam/application/exceptions/protected-member.exception';
import { PersonalAccountProtectedException } from '@/iam/application/exceptions/personal-account-protected.exception';

/** Tenant-scoped lookup (anti-IDOR): a member of another tenant is simply not found. */
export async function loadNonOwnerMember(
  memberships: MembershipRepositoryPort,
  tenantId: string,
  memberUserId: string,
  tx: TransactionContext,
): Promise<MemberRecord> {
  const member = await memberships.find(tenantId, memberUserId, tx);
  if (!member) throw new MemberNotFoundException();
  if (member.baseRole === 'OWNER') throw new ProtectedMemberException();
  return member;
}

export function isManagedBy(member: MemberRecord, tenantId: string): boolean {
  return member.accountManagedByTenantId === tenantId;
}

export function assertManagedBy(member: MemberRecord, tenantId: string): void {
  if (!isManagedBy(member, tenantId)) throw new PersonalAccountProtectedException();
}
