import { UserPermission } from '@/iam/domain/enums/permission.enum';

/** OWNER and base-role ADMIN (legacy admins) hold every permission; other members hold exactly their custom role's set. */
export function resolveEffectivePermissions(
  baseRole: string,
  rolePermissions: readonly string[],
): UserPermission[] {
  const all = Object.values(UserPermission);
  if (baseRole === 'OWNER' || baseRole === 'ADMIN') return all;
  return all.filter((permission): boolean => rolePermissions.includes(permission));
}
