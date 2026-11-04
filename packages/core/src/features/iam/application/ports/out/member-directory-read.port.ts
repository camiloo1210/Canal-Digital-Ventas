import type { MemberReadModel } from '@/iam/application/read-models/user-management.read-models';

export interface MemberDirectoryReadPort {
  listForOwner(userId: string, tenantId: string): Promise<MemberReadModel[]>;
}
