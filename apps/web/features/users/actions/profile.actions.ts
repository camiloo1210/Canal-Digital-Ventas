'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getUpdateOwnProfileUseCase } from '@/features/users/di/users.di';
import { profileSchema } from '@/features/users/schemas/users.schema';
import { resolveAuthenticatedUserId, usersErrorKey } from '@/features/users/actions/users-actor';
import type { ProfileActionState } from '@/features/users/types';

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

export async function updateOwnProfileAction(
  previous: ProfileActionState,
  data: FormData,
): Promise<ProfileActionState> {
  const t = await getTranslations('Profile');
  const e = await getTranslations('Users.errors');
  const values = {
    firstName: text(data, 'firstName'),
    lastName: text(data, 'lastName'),
    consent: text(data, 'consent') === 'on',
  };
  const revision = previous.revision + 1;
  const fail = (
    message: string,
    fieldErrors?: ProfileActionState['fieldErrors'],
  ): ProfileActionState => ({
    success: false,
    message,
    values,
    revision,
    ...(fieldErrors ? { fieldErrors } : {}),
  });
  try {
    // The user id is always the authenticated one; no id is read from the form.
    const userId = await resolveAuthenticatedUserId();
    if (!userId) return fail(e('unauthorized'));
    const parsed = profileSchema.safeParse({
      firstName: values.firstName,
      lastName: values.lastName,
      consent: values.consent ? 'on' : '',
    });
    if (!parsed.success) {
      const fieldErrors: NonNullable<ProfileActionState['fieldErrors']> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'firstName') fieldErrors.firstName = t('validation.nameRequired');
        if (issue.path[0] === 'lastName') fieldErrors.lastName = t('validation.nameRequired');
      }
      return fail(e('invalidInput'), fieldErrors);
    }
    await getUpdateOwnProfileUseCase().execute({
      userId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      demographicConsent: parsed.data.consent,
    });
    revalidatePath('/account/profile');
    return { success: true, message: t('saved'), values, revision };
  } catch (error: unknown) {
    const key = usersErrorKey(error);
    if (key === 'unexpected') console.error('[Users] updateOwnProfile failed', error);
    return fail(e(key));
  }
}
