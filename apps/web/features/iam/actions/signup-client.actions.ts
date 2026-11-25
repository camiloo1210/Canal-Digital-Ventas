'use server';

import { getTranslations } from 'next-intl/server';
import { authenticationLimitMessage } from '@/lib/security/authentication-rate-limit';
import { redirect } from 'next/navigation';
import { getRegisterGlobalIdentityUseCase } from '@/features/iam/di/iam.di';
import { getRecordSignupDemographicsUseCase } from '@/features/users/di/users.di';
import { resolveActiveTenantIdBySlugQuery } from '@/features/users/queries/tenant-id-by-slug.query';
import { consentSchema } from '@/features/users/schemas/users.schema';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';
import { ActionState } from '@/features/iam/actions/signup.actions';
import { clientSignupSchema } from '@/features/iam/schemas/auth.schema';

export async function signupClientAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limitMessage = await authenticationLimitMessage();
  if (limitMessage) return { success: false, error: limitMessage };
  const email = formData.get('email');
  const password = formData.get('password');
  const tenantSlug = formData.get('tenantSlug'); // Optional: Which store they came from

  const validatedFields = clientSignupSchema.safeParse({ email, password });

  if (!validatedFields.success) {
    const t = await getTranslations('Storefront.auth.errors');
    return {
      success: false,
      error: t(validatedFields.error.issues[0]?.message ?? 'email'),
    };
  }

  // Optional demographic consent: buckets outside the fixed lists are rejected up front.
  const consent = consentSchema.safeParse({
    consent: formData.get('consent'),
    ageRange: formData.get('ageRange'),
    gender: formData.get('gender'),
    province: formData.get('province'),
  });
  if (!consent.success) {
    const t = await getTranslations('Users.invite.errors');
    return { success: false, error: t('invalidInput') };
  }

  let success = false;
  let redirectUrl = '/buyer-dashboard';

  try {
    const useCase = await getRegisterGlobalIdentityUseCase();

    const userId = await useCase.execute({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
    });

    success = true;
    const slug = typeof tenantSlug === 'string' && tenantSlug ? tenantSlug : null;
    if (slug) redirectUrl = `/store/${slug}`;

    // Declined consent stores nothing. A failure here never blocks the new account.
    if (consent.data.consent) {
      try {
        const tenantId = slug ? await resolveActiveTenantIdBySlugQuery(slug, userId) : null;
        await getRecordSignupDemographicsUseCase().execute({
          userId,
          consent: true,
          ageRange: consent.data.ageRange,
          gender: consent.data.gender,
          province: consent.data.province,
          tenantId,
        });
      } catch (demographicsError: unknown) {
        console.error(
          '[Signup] demographic consent not recorded:',
          demographicsError instanceof Error ? demographicsError.name : 'UnknownError',
        );
      }
    }
  } catch (error: unknown) {
    if (error instanceof DomainException || error instanceof ApplicationException) {
      return { success: false, error: (error as Error).message };
    }

    console.error('Unexpected signup error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during signup. Please try again later.',
    };
  }

  if (success) {
    redirect(redirectUrl);
  }

  return { success: false, error: null };
}
