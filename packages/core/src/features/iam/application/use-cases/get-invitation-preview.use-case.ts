import type { InvitationPreviewReadPort } from '@/iam/application/ports/out/invitation-preview-read.port';
import type { TokenGeneratorPort } from '@/iam/application/ports/out/token-generator.port';
import type { InvitationPreviewReadModel } from '@/iam/application/read-models/user-management.read-models';

export class GetInvitationPreviewUseCase {
  public constructor(
    private readonly preview: InvitationPreviewReadPort,
    private readonly tokens: TokenGeneratorPort,
  ) {}

  /** Null for unknown, expired, revoked or exhausted tokens (indistinguishable on purpose). */
  public async execute(rawToken: string): Promise<InvitationPreviewReadModel | null> {
    const token = (rawToken ?? '').trim();
    if (!token) return null;
    return this.preview.findUsableByTokenHash(this.tokens.hash(token));
  }
}
