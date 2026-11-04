import type { InvitationReadModel } from '@/iam/application/read-models/user-management.read-models';

export interface InvitationReadPort {
  listForOwner(userId: string, tenantId: string): Promise<InvitationReadModel[]>;
}
