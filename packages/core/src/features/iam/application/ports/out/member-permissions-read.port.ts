import type { MemberPermissionsReadModel } from '@/iam/application/read-models/user-management.read-models';

export interface MemberPermissionsReadPort {
  /** Effective permissions of an active member; null when the user is not an active member. */
  findForUser(userId: string, tenantId: string): Promise<MemberPermissionsReadModel | null>;
}
