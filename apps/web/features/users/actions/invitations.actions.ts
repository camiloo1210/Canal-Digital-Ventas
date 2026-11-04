'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import {
  getCreateInvitationUseCase,
  getRevokeInvitationUseCase,
  isAdminAuthConfigured,
} from '@/features/users/di/users.di';
import {
  createInvitationSchema,
  revokeInvitationSchema,
} from '@/features/users/schemas/users.schema';
import {
  requestPublicOrigin,
  resolveUsersActor,
  usersErrorKey,
} from '@/features/users/actions/users-actor';
import type { InvitationActionState, UsersActionState } from '@/features/users/types';

const PATH = '/dashboard/users';

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

export async function createInvitationAction(
  previous: InvitationActionState,
  data: FormData,
): Promise<InvitationActionState> {
  const t = await getTranslations('Users');
  const values = {
    roleId: text(data, 'roleId'),
    expiresInDays: text(data, 'expiresInDays'),
    maxUses: text(data, 'maxUses'),
    accountMode: text(data, 'accountMode') || 'GENERATED_EMAIL',
  };
  const revision = previous.revision + 1;
  const fail = (
    key: string,
    fieldErrors?: InvitationActionState['fieldErrors'],
  ): InvitationActionState => ({
    success: false,
    message: t(`errors.${key}`),
    values,
    revision,
    ...(fieldErrors ? { fieldErrors } : {}),
  });
  try {
    const actor = await resolveUsersActor(data);
    if (actor === 'CONTEXT_CHANGED') return fail('contextChanged');
    if (!actor) return fail('unauthorized');
    const parsed = createInvitationSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: NonNullable<InvitationActionState['fieldErrors']> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'roleId') fieldErrors.roleId = t('invitations.validation.roleRequired');
        if (field === 'expiresInDays')
          fieldErrors.expiresInDays = t('invitations.validation.expiryInvalid');
        if (field === 'maxUses') fieldErrors.maxUses = t('invitations.validation.maxUsesInvalid');
        if (field === 'accountMode')
          fieldErrors.accountMode = t('invitations.validation.accountModeInvalid');
      }
      return fail('invalidInput', fieldErrors);
    }
    // Generated-email accounts can only be created with the service role key.
    if (parsed.data.accountMode === 'GENERATED_EMAIL' && !isAdminAuthConfigured()) {
      return fail('adminAuthUnavailable');
    }
    const result = await getCreateInvitationUseCase().execute({ ...actor, ...parsed.data });
    const origin = await requestPublicOrigin();
    const path = `/invite/${result.token}`;
    revalidatePath(PATH);
    return {
      success: true,
      message: t('invitations.created'),
      link: origin ? `${origin}${path}` : path,
      expiresAt: result.expiresAt,
      revision,
    };
  } catch (error: unknown) {
    const key = usersErrorKey(error);
    if (key === 'unexpected') console.error('[Users] createInvitation failed', error);
    return fail(key);
  }
}

export async function revokeInvitationAction(
  previous: UsersActionState,
  data: FormData,
): Promise<UsersActionState> {
  const t = await getTranslations('Users');
  const revision = previous.revision + 1;
  const fail = (key: string): UsersActionState => ({
    success: false,
    message: t(`errors.${key}`),
    revision,
  });
  try {
    const actor = await resolveUsersActor(data);
    if (actor === 'CONTEXT_CHANGED') return fail('contextChanged');
    if (!actor) return fail('unauthorized');
    const parsed = revokeInvitationSchema.safeParse({ invitationId: data.get('invitationId') });
    if (!parsed.success) return fail('invalidInput');
    await getRevokeInvitationUseCase().execute({
      ...actor,
      invitationId: parsed.data.invitationId,
    });
    revalidatePath(PATH);
    return { success: true, message: t('invitations.revoked'), revision };
  } catch (error: unknown) {
    const key = usersErrorKey(error);
    if (key === 'unexpected') console.error('[Users] revokeInvitation failed', error);
    return fail(key);
  }
}
