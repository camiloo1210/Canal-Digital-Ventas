import type { OwnProfileReadModel } from '@/iam/application/read-models/user-management.read-models';

export interface OwnProfileReadPort {
  /** The authenticated user's own profile; null when no profile row exists. */
  findForUser(userId: string): Promise<OwnProfileReadModel | null>;
}
