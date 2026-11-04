import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptInvitationAction,
  acceptInvitationAsCurrentUserAction,
} from '@/features/users/actions/invite.actions';
import { startGoogleInvitationAction } from '@/features/users/actions/google-invite.actions';
import { completeGoogleInvitation } from '@/features/users/google-invitation';
import { parseGoogleInviteCookie } from '@/features/users/google-invite-cookie';
import type { AcceptInvitationActionState } from '@/features/users/types';

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  staffExecute: vi.fn(),
  staffRollback: vi.fn(),
  accept: vi.fn(),
  preview: vi.fn(),
  signUp: vi.fn(),
  limit: vi.fn(),
  redirect: vi.fn(),
  cookieSet: vi.fn(),
  oauthUrl: vi.fn(),
  boundElsewhere: vi.fn(),
}));

vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string, values?: Record<string, string>) => string> =>
    (key: string, values?: Record<string, string>): string =>
      values?.reason ? `${key}|${values.reason}` : key,
}));
vi.mock('server-only', (): object => ({}));
vi.mock('next/headers', (): object => ({
  cookies: async (): Promise<object> => ({ set: mocks.cookieSet, delete: vi.fn() }),
  headers: async (): Promise<Headers> =>
    new Headers({ host: 'shop.test', 'x-forwarded-proto': 'https' }),
}));
vi.mock('next/navigation', (): object => ({
  redirect: (path: string): never => {
    mocks.redirect(path);
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('@/lib/security/authentication-rate-limit', (): object => ({
  authenticationLimitMessage: mocks.limit,
}));
vi.mock('@/features/users/actions/users-actor', async (importOriginal): Promise<object> => ({
  ...(await importOriginal<object>()),
  resolveAuthenticatedIdentity: mocks.identity,
}));
vi.mock('@/features/iam/di/iam.di', (): object => ({
  getRegisterGlobalIdentityUseCase: async (): Promise<object> => ({ execute: mocks.signUp }),
  getGetOAuthSignInUrlUseCase: async (): Promise<object> => ({ execute: mocks.oauthUrl }),
}));
vi.mock('@/features/users/di/users.di', (): object => ({
  getAcceptInvitationUseCase: (): object => ({ execute: mocks.accept }),
  getGetInvitationPreviewUseCase: (): object => ({ execute: mocks.preview }),
  getBusinessAccountReadRepository: (): object => ({ isBoundToOtherTenant: mocks.boundElsewhere }),
  getCreateStaffAccountUseCase: async (): Promise<object> => ({
    execute: mocks.staffExecute,
    rollback: mocks.staffRollback,
  }),
}));

const userId = crypto.randomUUID();
const token = 'x'.repeat(43);
const initial: AcceptInvitationActionState = { success: false, message: null, revision: 0 };
const TENANT_ID = crypto.randomUUID();
const GENERATED_EMAIL = 'ana-perez.abcdef@shop.staff.invalid';

class NamedFailure extends Error {
  public constructor(name: string) {
    super(name);
    this.name = name;
  }
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

function previewWith(accountMode: string): void {
  mocks.preview.mockResolvedValue({
    tenantId: TENANT_ID,
    tenantName: 'Shop',
    tenantSlug: 'shop',
    roleName: 'Seller',
    accountMode,
  });
}

beforeEach((): void => {
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue(null);
  mocks.identity.mockResolvedValue({ id: userId, email: 'me@shop.test', provider: 'email' });
  mocks.staffExecute.mockResolvedValue({ userId, email: GENERATED_EMAIL });
  mocks.staffRollback.mockResolvedValue(true);
  mocks.accept.mockResolvedValue({ tenantId: crypto.randomUUID(), roleId: crypto.randomUUID() });
  mocks.oauthUrl.mockResolvedValue('https://accounts.google.test/auth');
  mocks.boundElsewhere.mockResolvedValue(false);
  previewWith('GENERATED_EMAIL');
});

describe('accept invitation: GENERATED_EMAIL', (): void => {
  const generated = {
    token,
    mode: 'GENERATED_EMAIL',
    password: 'long-enough-1',
    confirmPassword: 'long-enough-1',
    firstName: 'Ana',
    lastName: 'Perez',
  };

  it('creates the account from the names and shows the email instead of redirecting', async (): Promise<void> => {
    const result = await acceptInvitationAction(
      initial,
      form({ ...generated, email: 'evil@x.com' }),
    );
    expect(result.success).toBe(true);
    expect(result.generatedEmail).toBe(GENERATED_EMAIL);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.staffExecute).toHaveBeenCalledWith({
      firstName: 'Ana',
      lastName: 'Perez',
      tenantSlug: 'shop',
      tenantId: TENANT_ID,
      password: 'long-enough-1',
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.accept).toHaveBeenCalledWith(
      expect.objectContaining({ token, userId, firstName: 'Ana', lastName: 'Perez' }),
    );
    expect(JSON.stringify(result)).not.toContain('long-enough-1');
  });

  it('creates no user for a dead invitation', async (): Promise<void> => {
    mocks.preview.mockResolvedValue(null);
    const result = await acceptInvitationAction(initial, form(generated));
    expect(result.message).toBe('invite.errors.invitationNotUsable');
    expect(mocks.staffExecute).not.toHaveBeenCalled();
  });

  it('rolls the auth user back when acceptance fails', async (): Promise<void> => {
    mocks.accept.mockRejectedValue(new NamedFailure('InvitationNotUsableException'));
    const result = await acceptInvitationAction(initial, form(generated));
    expect(result.success).toBe(false);
    expect(mocks.staffRollback).toHaveBeenCalledWith(userId);
    expect(result.message).toBe('invite.errors.acceptFailedRolledBack|errors.invitationNotUsable');
    expect(result.generatedEmail).toBeUndefined();
  });

  it('reveals the email when the rollback is impossible so the person can still sign in', async (): Promise<void> => {
    mocks.staffRollback.mockResolvedValue(false);
    mocks.accept.mockRejectedValue(new NamedFailure('InvitationNotUsableException'));
    const result = await acceptInvitationAction(initial, form(generated));
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      'invite.errors.acceptFailedGeneratedAccount|errors.invitationNotUsable',
    );
    expect(result.generatedEmail).toBe(GENERATED_EMAIL);
  });

  it('survives a failing rollback without leaking it', async (): Promise<void> => {
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    mocks.staffRollback.mockRejectedValue(new Error('admin down'));
    mocks.accept.mockRejectedValue(new NamedFailure('InvitationNotUsableException'));
    const result = await acceptInvitationAction(initial, form(generated));
    expect(result.success).toBe(false);
    expect(result.generatedEmail).toBe(GENERATED_EMAIL);
    spy.mockRestore();
  });

  it('shows a clear error when email confirmation blocks the account (no session)', async (): Promise<void> => {
    mocks.staffExecute.mockRejectedValue(
      new NamedFailure('StaffAccountConfirmationRequiredException'),
    );
    const result = await acceptInvitationAction(initial, form(generated));
    expect(result.message).toBe('invite.errors.confirmationRequired');
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('reports a missing service role key without creating or accepting anything', async (): Promise<void> => {
    mocks.staffExecute.mockRejectedValue(new NamedFailure('AdminAuthUnavailableException'));
    const result = await acceptInvitationAction(initial, form(generated));
    expect(result.success).toBe(false);
    expect(result.message).toBe('invite.errors.adminAuthUnavailable');
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('reports exhausted collision retries', async (): Promise<void> => {
    mocks.staffExecute.mockRejectedValue(
      new NamedFailure('StaffEmailGenerationExhaustedException'),
    );
    const result = await acceptInvitationAction(initial, form(generated));
    expect(result.message).toBe('invite.errors.emailGenerationFailed');
  });

  it('requires the password confirmation to match', async (): Promise<void> => {
    const result = await acceptInvitationAction(
      initial,
      form({ ...generated, confirmPassword: 'different-1' }),
    );
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.confirmPassword).toBe('invite.validation.passwordMismatch');
    expect(mocks.staffExecute).not.toHaveBeenCalled();
  });

  it('requires a password and names', async (): Promise<void> => {
    const result = await acceptInvitationAction(
      initial,
      form({ ...generated, password: 'short', firstName: '' }),
    );
    expect(result.fieldErrors?.password).toBeTruthy();
    expect(result.fieldErrors?.firstName).toBeTruthy();
    expect(mocks.staffExecute).not.toHaveBeenCalled();
  });
});

describe('accept invitation: mode enforcement', (): void => {
  const base = { token, password: 'long-enough-1', firstName: 'Ana', lastName: 'Perez' };

  it('rejects a real-email registration against a generated-email invitation', async (): Promise<void> => {
    const result = await acceptInvitationAction(
      initial,
      form({ ...base, mode: 'REAL_EMAIL', email: 'me@gmail.com' }),
    );
    expect(result.message).toBe('invite.errors.modeMismatch');
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.staffExecute).not.toHaveBeenCalled();
  });

  it('rejects a generated-email registration against a real-email invitation', async (): Promise<void> => {
    previewWith('REAL_EMAIL');
    const result = await acceptInvitationAction(
      initial,
      form({ ...base, mode: 'GENERATED_EMAIL' }),
    );
    expect(result.message).toBe('invite.errors.modeMismatch');
    expect(mocks.staffExecute).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('rejects a missing or unknown mode', async (): Promise<void> => {
    for (const entries of [base, { ...base, mode: 'SMS' }]) {
      const result = await acceptInvitationAction(initial, form(entries));
      expect(result.success).toBe(false);
    }
    expect(mocks.staffExecute).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('never lets a GOOGLE invitation through the password form', async (): Promise<void> => {
    previewWith('GOOGLE');
    for (const mode of ['GOOGLE', 'REAL_EMAIL', 'GENERATED_EMAIL']) {
      const result = await acceptInvitationAction(
        initial,
        form({ ...base, mode, email: 'a@b.com' }),
      );
      expect(result.success).toBe(false);
    }
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.staffExecute).not.toHaveBeenCalled();
    expect(mocks.accept).not.toHaveBeenCalled();
  });
});

describe('accept with the current account', (): void => {
  it('GENERATED_EMAIL refuses a personal account', async (): Promise<void> => {
    const result = await acceptInvitationAsCurrentUserAction(initial, form({ token }));
    expect(result.message).toBe('invite.errors.modeMismatch');
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('GENERATED_EMAIL allows retrying with the generated account of that tenant', async (): Promise<void> => {
    mocks.identity.mockResolvedValue({ id: userId, email: GENERATED_EMAIL, provider: 'email' });
    await expect(acceptInvitationAsCurrentUserAction(initial, form({ token }))).rejects.toThrow(
      'NEXT_REDIRECT',
    );
    expect(mocks.accept).toHaveBeenCalledWith(expect.objectContaining({ token, userId }));
  });

  it('GENERATED_EMAIL refuses a generated account of another tenant', async (): Promise<void> => {
    mocks.identity.mockResolvedValue({
      id: userId,
      email: 'ana.abcdef@other.staff.invalid',
      provider: 'email',
    });
    const result = await acceptInvitationAsCurrentUserAction(initial, form({ token }));
    expect(result.message).toBe('invite.errors.modeMismatch');
  });

  it('GOOGLE requires a Google session', async (): Promise<void> => {
    previewWith('GOOGLE');
    const refused = await acceptInvitationAsCurrentUserAction(initial, form({ token }));
    expect(refused.message).toBe('invite.errors.modeMismatch');
    mocks.identity.mockResolvedValue({ id: userId, email: 'g@gmail.com', provider: 'google' });
    await expect(acceptInvitationAsCurrentUserAction(initial, form({ token }))).rejects.toThrow(
      'NEXT_REDIRECT',
    );
  });

  it('refuses a business account of ANOTHER company before accepting anything', async (): Promise<void> => {
    previewWith('REAL_EMAIL');
    mocks.boundElsewhere.mockResolvedValue(true);
    const result = await acceptInvitationAsCurrentUserAction(initial, form({ token }));
    expect(result.success).toBe(false);
    expect(result.message).toBe('errors.businessAccountBound');
    expect(mocks.boundElsewhere).toHaveBeenCalledWith(userId, TENANT_ID);
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('maps a late BusinessAccountBoundException (database trigger) to the same message', async (): Promise<void> => {
    previewWith('REAL_EMAIL');
    mocks.accept.mockRejectedValue(new NamedFailure('BusinessAccountBoundException'));
    const result = await acceptInvitationAsCurrentUserAction(initial, form({ token }));
    expect(result.message).toBe('errors.businessAccountBound');
  });

  it('REAL_EMAIL accepts any signed-in account', async (): Promise<void> => {
    previewWith('REAL_EMAIL');
    await expect(acceptInvitationAsCurrentUserAction(initial, form({ token }))).rejects.toThrow(
      'NEXT_REDIRECT',
    );
  });
});

describe('Google invitation start', (): void => {
  beforeEach((): void => previewWith('GOOGLE'));

  it('stores token and consent in a short-lived httpOnly cookie, then redirects to Google', async (): Promise<void> => {
    await expect(
      startGoogleInvitationAction(
        form({ token, consent: 'on', ageRange: '25_34', gender: 'FEMALE', province: 'AZUAY' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT');
    const [name, value, options] = mocks.cookieSet.mock.calls[0];
    expect(name).toBe('invite_google_pending');
    expect(JSON.parse(value)).toEqual({
      token,
      consent: true,
      ageRange: '25_34',
      gender: 'FEMALE',
      province: 'AZUAY',
    });
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 900, path: '/' });
    expect(mocks.oauthUrl).toHaveBeenCalledWith({
      provider: 'google',
      redirectTo: 'https://shop.test/auth/callback',
    });
    expect(mocks.redirect).toHaveBeenCalledWith('https://accounts.google.test/auth');
  });

  it('drops demographic choices without consent', async (): Promise<void> => {
    await expect(
      startGoogleInvitationAction(form({ token, ageRange: '25_34', gender: 'FEMALE' })),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(JSON.parse(mocks.cookieSet.mock.calls[0][1])).toEqual({ token, consent: false });
  });

  it('refuses invitations that are not in GOOGLE mode or are dead, without setting a cookie', async (): Promise<void> => {
    previewWith('REAL_EMAIL');
    await expect(startGoogleInvitationAction(form({ token }))).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenLastCalledWith(`/invite/${token}?error=modeMismatch`);
    mocks.preview.mockResolvedValue(null);
    await expect(startGoogleInvitationAction(form({ token }))).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenLastCalledWith(`/invite/${token}?error=invitationNotUsable`);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('rejects malformed tokens and bad buckets without touching cookies', async (): Promise<void> => {
    await expect(startGoogleInvitationAction(form({ token: '../x' }))).rejects.toThrow(
      'NEXT_REDIRECT',
    );
    expect(mocks.redirect).toHaveBeenLastCalledWith('/');
    await expect(
      startGoogleInvitationAction(form({ token, consent: 'on', ageRange: '27' })),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenLastCalledWith(`/invite/${token}?error=invalidInput`);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('is rate limited', async (): Promise<void> => {
    mocks.limit.mockResolvedValue('slow down');
    await expect(startGoogleInvitationAction(form({ token }))).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenLastCalledWith(`/invite/${token}?error=rateLimited`);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('reports a failure to build the Google url and leaves no cookie behind', async (): Promise<void> => {
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    mocks.oauthUrl.mockRejectedValue(new Error('oauth down'));
    await expect(startGoogleInvitationAction(form({ token }))).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenLastCalledWith(`/invite/${token}?error=googleStartFailed`);
    spy.mockRestore();
  });
});

describe('Google invitation cookie', (): void => {
  it('parses a well formed value', (): void => {
    expect(parseGoogleInviteCookie(JSON.stringify({ token, consent: false }))).toEqual({
      token,
      consent: false,
    });
  });

  it('never trusts malformed, tampered or oversized values', (): void => {
    for (const raw of [
      '',
      'not json',
      '[]',
      'null',
      JSON.stringify({ consent: true }),
      JSON.stringify({ token: 'short', consent: false }),
      JSON.stringify({ token: `${token}/../x`, consent: false }),
      JSON.stringify({ token, consent: 'yes' }),
      JSON.stringify({ token, consent: true, ageRange: '27' }),
      JSON.stringify({ token, consent: true, province: 'DROP TABLE' }),
      JSON.stringify({ token, consent: false, ageRange: '25_34' }),
      'x'.repeat(5000),
    ]) {
      expect(parseGoogleInviteCookie(raw), raw.slice(0, 40)).toBeNull();
    }
  });
});

describe('completing a Google invitation after the OAuth callback', (): void => {
  const cookie = {
    token,
    consent: true,
    ageRange: '25_34',
    gender: 'FEMALE',
    province: 'AZUAY',
  } as const;

  it('accepts the invitation for the session user with the stored consent', async (): Promise<void> => {
    previewWith('GOOGLE');
    const result = await completeGoogleInvitation(cookie, userId);
    expect(result).toEqual({ ok: true });
    expect(mocks.accept).toHaveBeenCalledWith({
      token,
      userId,
      demographicConsent: true,
      ageRange: '25_34',
      gender: 'FEMALE',
      province: 'AZUAY',
    });
  });

  it('refuses a business account of another company', async (): Promise<void> => {
    previewWith('GOOGLE');
    mocks.boundElsewhere.mockResolvedValue(true);
    expect(await completeGoogleInvitation(cookie, userId)).toEqual({
      ok: false,
      error: 'businessAccountBound',
    });
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('fails without accepting when the invitation is dead or not a GOOGLE one', async (): Promise<void> => {
    mocks.preview.mockResolvedValue(null);
    expect(await completeGoogleInvitation(cookie, userId)).toEqual({
      ok: false,
      error: 'invitationNotUsable',
    });
    previewWith('REAL_EMAIL');
    expect(await completeGoogleInvitation(cookie, userId)).toEqual({
      ok: false,
      error: 'modeMismatch',
    });
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('maps acceptance failures to page error codes and masks unexpected ones', async (): Promise<void> => {
    previewWith('GOOGLE');
    mocks.accept.mockRejectedValue(new NamedFailure('AlreadyMemberException'));
    expect(await completeGoogleInvitation(cookie, userId)).toEqual({
      ok: false,
      error: 'alreadyMember',
    });
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    mocks.accept.mockRejectedValue(new Error('db password leaked'));
    expect(await completeGoogleInvitation(cookie, userId)).toEqual({
      ok: false,
      error: 'unexpected',
    });
    spy.mockRestore();
  });
});
