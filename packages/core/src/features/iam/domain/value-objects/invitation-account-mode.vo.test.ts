import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVITATION_ACCOUNT_MODE,
  INVITATION_ACCOUNT_MODES,
  parseInvitationAccountMode,
} from '@/iam/domain/value-objects/invitation-account-mode.vo';
import { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';

describe('invitation account mode', (): void => {
  it('defaults to generated email and lists the three modes', (): void => {
    expect(DEFAULT_INVITATION_ACCOUNT_MODE).toBe('GENERATED_EMAIL');
    expect([...INVITATION_ACCOUNT_MODES]).toEqual(['GENERATED_EMAIL', 'REAL_EMAIL', 'GOOGLE']);
  });
  it('parses valid values and rejects anything else', (): void => {
    expect(parseInvitationAccountMode('GOOGLE')).toBe('GOOGLE');
    expect(() => parseInvitationAccountMode('google')).toThrow(InvalidInvitationException);
    expect(() => parseInvitationAccountMode('')).toThrow(InvalidInvitationException);
  });
});
