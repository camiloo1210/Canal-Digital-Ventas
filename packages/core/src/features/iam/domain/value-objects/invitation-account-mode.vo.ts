import { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';

/**
 * How the invited person gets an account:
 * - GENERATED_EMAIL: the system derives a non-deliverable login address inside the tenant.
 * - REAL_EMAIL: the person types their own email.
 * - GOOGLE: the person signs in with Google.
 */
export const INVITATION_ACCOUNT_MODES = ['GENERATED_EMAIL', 'REAL_EMAIL', 'GOOGLE'] as const;

export type InvitationAccountMode = (typeof INVITATION_ACCOUNT_MODES)[number];

export const DEFAULT_INVITATION_ACCOUNT_MODE: InvitationAccountMode = 'GENERATED_EMAIL';

export function parseInvitationAccountMode(value: unknown): InvitationAccountMode {
  const mode = INVITATION_ACCOUNT_MODES.find((candidate): boolean => candidate === value);
  if (!mode) throw new InvalidInvitationException('Unknown invitation account mode');
  return mode;
}
