import type { InvitationPreviewReadModel } from '@/iam/application/read-models/user-management.read-models';

export interface InvitationPreviewReadPort {
  /** Returns null unless the invitation exists and is currently usable. */
  findUsableByTokenHash(tokenHash: string): Promise<InvitationPreviewReadModel | null>;
}
