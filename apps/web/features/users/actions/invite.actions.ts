'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { authenticationLimitMessage } from '@/lib/security/authentication-rate-limit';
import {
  isGeneratedStaffEmailOf,
  type InvitationPreviewReadModel,
} from '@canaldigital/packages/core';
import { writeActiveTenantCookie } from '@/features/iam/utils/active-tenant-cookie';
import { withTenant } from '@/features/dashboard/utils/tenant-scope';
import { getRegisterGlobalIdentityUseCase } from '@/features/iam/di/iam.di';
import {
  getAcceptInvitationUseCase,
  getBusinessAccountReadRepository,
  getCreateStaffAccountUseCase,
  getGetInvitationPreviewUseCase,
} from '@/features/users/di/users.di';
import {
  acceptAsCurrentUserSchema,
  acceptGeneratedInvitationSchema,
  acceptRealEmailInvitationSchema,
  invitationEntrySchema,
} from '@/features/users/schemas/users.schema';
import { resolveAuthenticatedIdentity, usersErrorKey } from '@/features/users/actions/users-actor';
import type { AcceptInvitationActionState, ConsentValues } from '@/features/users/types';

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

function consentValues(data: FormData): ConsentValues {
  const consent = text(data, 'consent') === 'on';
  // Nothing demographic is echoed back or sent anywhere without consent.
  return {
    consent,
    ageRange: consent ? text(data, 'ageRange') : '',
    gender: consent ? text(data, 'gender') : '',
    province: consent ? text(data, 'province') : '',
  };
}

type AcceptState = AcceptInvitationActionState;

/**
 * New account + invitation. The Supabase Auth user is created first because the acceptance
 * transaction needs it to exist. The invitation's stored account mode decides which form is valid:
 * the submitted mode must match it, so a generated-email invitation cannot register an arbitrary
 * address (and vice versa) and a GOOGLE invitation never accepts a password registration.
 * No auth user is created for a dead invitation; if acceptance fails after creation the user is
 * deleted when the admin key allows it (see CreateStaffAccountUseCase.rollback).
 */
/**
 * Lands the person in the business they just joined. The membership was created by the server a
 * moment ago, so remembering it as the default is safe; it is best-effort and never blocks the
 * redirect (an owner of other businesses simply reaches the selector without it).
 */
async function rememberJoinedBusiness(tenantId: string | null): Promise<void> {
  if (!tenantId) return;
  try {
    await writeActiveTenantCookie(tenantId);
  } catch {
    // Cookie storage unavailable: the dashboard falls back to the business selector.
  }
}

export async function acceptInvitationAction(
  previous: AcceptState,
  data: FormData,
): Promise<AcceptState> {
  const t = await getTranslations('Users');
  const consent = consentValues(data);
  const values = {
    ...consent,
    email: text(data, 'email'),
    firstName: text(data, 'firstName'),
    lastName: text(data, 'lastName'),
  };
  const revision = previous.revision + 1;
  const fail = (key: string, fieldErrors?: AcceptState['fieldErrors']): AcceptState => ({
    success: false,
    message: t(`invite.errors.${key}`),
    values,
    revision,
    ...(fieldErrors ? { fieldErrors } : {}),
  });

  const limitMessage = await authenticationLimitMessage();
  if (limitMessage) return { success: false, message: limitMessage, values, revision };

  const entry = invitationEntrySchema.safeParse({
    token: text(data, 'token'),
    mode: text(data, 'mode'),
  });
  if (!entry.success) return fail('invalidInput');

  let preview: InvitationPreviewReadModel | null;
  try {
    // Do not create an auth user for an invitation that is already unusable.
    preview = await getGetInvitationPreviewUseCase().execute(entry.data.token);
  } catch (error: unknown) {
    console.error('[Users] invitation preview failed', error);
    return fail('registrationFailed');
  }
  if (!preview) return fail('invitationNotUsable');
  if (preview.accountMode === 'GOOGLE' || preview.accountMode !== entry.data.mode) {
    return fail('modeMismatch');
  }

  const rawInput = {
    token: entry.data.token,
    email: values.email,
    password: text(data, 'password'),
    confirmPassword: text(data, 'confirmPassword'),
    firstName: values.firstName,
    lastName: values.lastName,
    consent: consent.consent ? 'on' : '',
    ageRange: consent.ageRange,
    gender: consent.gender,
    province: consent.province,
  };
  const parsed =
    preview.accountMode === 'GENERATED_EMAIL'
      ? acceptGeneratedInvitationSchema.safeParse(rawInput)
      : acceptRealEmailInvitationSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: NonNullable<AcceptState['fieldErrors']> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'email') fieldErrors.email = t('invite.validation.emailInvalid');
      if (field === 'password') fieldErrors.password = t('invite.validation.passwordLength');
      if (field === 'confirmPassword')
        fieldErrors.confirmPassword = t('invite.validation.passwordMismatch');
      if (field === 'firstName') fieldErrors.firstName = t('invite.validation.nameRequired');
      if (field === 'lastName') fieldErrors.lastName = t('invite.validation.nameRequired');
    }
    return fail('invalidInput', fieldErrors);
  }
  const input = parsed.data;

  const generated = preview.accountMode === 'GENERATED_EMAIL';
  let userId: string;
  let generatedEmail: string | null = null;
  try {
    if (generated) {
      const account = await (
        await getCreateStaffAccountUseCase()
      ).execute({
        firstName: input.firstName,
        lastName: input.lastName,
        tenantSlug: preview.tenantSlug,
        tenantId: preview.tenantId,
        password: input.password,
      });
      userId = account.userId;
      generatedEmail = account.email;
    } else {
      userId = await (
        await getRegisterGlobalIdentityUseCase()
      ).execute({ email: 'email' in input ? input.email : '', password: input.password });
    }
  } catch (error: unknown) {
    const key = usersErrorKey(error);
    if (
      key === 'confirmationRequired' ||
      key === 'emailGenerationFailed' ||
      key === 'adminAuthUnavailable'
    ) {
      return fail(key);
    }
    console.error('[Users] invitation signup failed', error);
    return fail('registrationFailed');
  }

  let joinedTenantId: string | null = null;
  try {
    const joined = await getAcceptInvitationUseCase().execute({
      token: input.token,
      userId,
      firstName: input.firstName,
      lastName: input.lastName,
      demographicConsent: input.consent,
      ageRange: input.ageRange,
      gender: input.gender,
      province: input.province,
    });
    joinedTenantId = joined?.tenantId ?? null;
  } catch (error: unknown) {
    const key = usersErrorKey(error);
    if (key === 'unexpected') console.error('[Users] acceptInvitation failed', error);
    const reason = t(`errors.${key}`);
    if (!generated) {
      return {
        success: false,
        message: t('invite.errors.acceptFailedAccountCreated', { reason }),
        values,
        revision,
      };
    }
    let rolledBack = false;
    try {
      rolledBack = await (await getCreateStaffAccountUseCase()).rollback(userId);
    } catch (rollbackError: unknown) {
      console.error('[Users] staff account rollback failed', rollbackError);
    }
    return rolledBack
      ? {
          success: false,
          message: t('invite.errors.acceptFailedRolledBack', { reason }),
          values,
          revision,
        }
      : {
          success: false,
          message: t('invite.errors.acceptFailedGeneratedAccount', { reason }),
          values,
          generatedEmail: generatedEmail ?? undefined,
          revision,
        };
  }

  if (generatedEmail) {
    // The sign-in cookie re-renders the invitation page, whose last use may now be consumed.
    // A separate authenticated page keeps the login address visible after that transition.
    await rememberJoinedBusiness(joinedTenantId);
    redirect('/invite/complete');
  }
  await rememberJoinedBusiness(joinedTenantId);
  redirect(withTenant('/dashboard', joinedTenantId));
}

/** Signed-in visitor accepts the invitation with their existing account. */
export async function acceptInvitationAsCurrentUserAction(
  previous: AcceptInvitationActionState,
  data: FormData,
): Promise<AcceptInvitationActionState> {
  const t = await getTranslations('Users');
  const consent = consentValues(data);
  const values = { ...consent, email: '', firstName: '', lastName: '' };
  const revision = previous.revision + 1;
  const fail = (key: string): AcceptInvitationActionState => ({
    success: false,
    message: key.startsWith('errors.') ? t(key) : t(`invite.errors.${key}`),
    values,
    revision,
  });

  const limitMessage = await authenticationLimitMessage();
  if (limitMessage) return { success: false, message: limitMessage, values, revision };

  const parsed = acceptAsCurrentUserSchema.safeParse({
    token: text(data, 'token'),
    consent: consent.consent ? 'on' : '',
    ageRange: consent.ageRange,
    gender: consent.gender,
    province: consent.province,
  });
  if (!parsed.success) return fail('invalidInput');

  let joinedTenantId: string | null = null;
  try {
    const identity = await resolveAuthenticatedIdentity();
    if (!identity) return fail('notSignedIn');
    const preview = await getGetInvitationPreviewUseCase().execute(parsed.data.token);
    if (!preview) return fail('invitationNotUsable');
    // Generated invitations only accept that tenant's generated accounts (a retry after a partial
    // failure); GOOGLE ones only a Google session. Anything else would bypass the owner's choice.
    if (
      (preview.accountMode === 'GENERATED_EMAIL' &&
        !isGeneratedStaffEmailOf(identity.email, preview.tenantSlug)) ||
      (preview.accountMode === 'GOOGLE' && identity.provider !== 'google')
    ) {
      return fail('modeMismatch');
    }
    // A business account belongs to ONE company for ever (the database trigger is the authority;
    // this is the early, friendly answer).
    if (
      await getBusinessAccountReadRepository().isBoundToOtherTenant(identity.id, preview.tenantId)
    ) {
      return fail('errors.businessAccountBound');
    }
    const joined = await getAcceptInvitationUseCase().execute({
      token: parsed.data.token,
      userId: identity.id,
      demographicConsent: parsed.data.consent,
      ageRange: parsed.data.ageRange,
      gender: parsed.data.gender,
      province: parsed.data.province,
    });
    joinedTenantId = joined?.tenantId ?? null;
  } catch (error: unknown) {
    const key = usersErrorKey(error);
    if (key === 'unexpected')
      console.error('[Users] acceptInvitation (current user) failed', error);
    return fail(`errors.${key}`);
  }

  await rememberJoinedBusiness(joinedTenantId);
  redirect(withTenant('/dashboard', joinedTenantId));
}
