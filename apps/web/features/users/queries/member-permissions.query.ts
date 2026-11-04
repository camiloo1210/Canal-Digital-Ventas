import 'server-only';
import { cache } from 'react';
import type { MemberPermissionsReadModel, UserPermission } from '@canaldigital/packages/core';
import { getMemberPermissionsReadRepository } from '@/features/users/di/users.di';

/** Request-scoped effective permissions of an active member; null when not an active member. */
export const getMemberPermissionsQuery = cache(
  async (userId: string, tenantId: string): Promise<MemberPermissionsReadModel | null> =>
    getMemberPermissionsReadRepository().findForUser(userId, tenantId),
);

/** True when the user is an owner or holds at least one of the required permissions. */
export async function userHasAnyPermission(
  userId: string,
  tenantId: string,
  required: readonly UserPermission[],
): Promise<boolean> {
  const member = await getMemberPermissionsQuery(userId, tenantId);
  if (!member) return false;
  if (member.baseRole === 'OWNER') return true;
  return required.some((permission): boolean => member.permissions.includes(permission));
}
